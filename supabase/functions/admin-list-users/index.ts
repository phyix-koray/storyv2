import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOOTSTRAP_ADMIN_EMAIL = "koray@phyix.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (user.email === BOOTSTRAP_ADMIN_EMAIL) {
      await adminClient.from("user_roles").upsert(
        { user_id: user.id, role: "admin" },
        { onConflict: "user_id,role" }
      );
    }

    const { data: roleCheck } = await adminClient
      .from("user_roles").select("id")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* no body = list */ }

    // Toggle admin
    if (body.action === "toggle_admin") {
      const targetUserId = body.user_id;
      const grant = body.grant;
      if (!targetUserId) throw new Error("Missing user_id");
      if (grant) {
        await adminClient.from("user_roles").upsert({ user_id: targetUserId, role: "admin" }, { onConflict: "user_id,role" });
      } else {
        const { data: targetUser } = await adminClient.auth.admin.getUserById(targetUserId);
        if (targetUser?.user?.email === BOOTSTRAP_ADMIN_EMAIL) {
          return new Response(JSON.stringify({ error: "Cannot remove bootstrap admin" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await adminClient.from("user_roles").delete().eq("user_id", targetUserId).eq("role", "admin");
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Reset password
    if (body.action === "reset_password") {
      const targetEmail = body.email;
      if (!targetEmail) throw new Error("Missing email");
      const { error: linkError } = await adminClient.auth.admin.generateLink({ type: "recovery", email: targetEmail });
      if (linkError) throw linkError;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Add credits (admin can add to any user via service role)
    if (body.action === "add_credits") {
      const targetUserId = body.user_id;
      const amount = body.amount;
      if (!targetUserId || !amount) throw new Error("Missing user_id or amount");

      // Get current credits
      const { data: currentCredits } = await adminClient.from("user_credits").select("credits").eq("user_id", targetUserId).single();
      if (!currentCredits) throw new Error("User credits not found");

      await adminClient.from("user_credits").update({ credits: currentCredits.credits + amount }).eq("user_id", targetUserId);
      await adminClient.from("credit_transactions").insert({
        user_id: targetUserId, amount, type: "admin_topup",
        description: `Admin tarafından $${amount.toFixed(2)} eklendi`,
      });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update plan
    if (body.action === "update_plan") {
      const targetUserId = body.user_id;
      const plan = body.plan;
      if (!targetUserId || !plan) throw new Error("Missing user_id or plan");

      const updateData: any = {
        plan,
        plan_started_at: new Date().toISOString(),
      };
      if (body.plan_expires_at) {
        updateData.plan_expires_at = new Date(body.plan_expires_at).toISOString();
      } else {
        updateData.plan_expires_at = null;
      }

      await adminClient.from("user_credits").update(updateData).eq("user_id", targetUserId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Delete user
    if (body.action === "delete_user") {
      const targetUserId = body.user_id;
      if (!targetUserId) throw new Error("Missing user_id");
      const { data: targetUser } = await adminClient.auth.admin.getUserById(targetUserId);
      if (targetUser?.user?.email === BOOTSTRAP_ADMIN_EMAIL) {
        return new Response(JSON.stringify({ error: "Cannot delete bootstrap admin" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (deleteError) throw deleteError;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Default: list all users
    const allUsers: any[] = [];
    let page = 1;
    while (true) {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      if (!users || users.length === 0) break;
      allUsers.push(...users);
      if (users.length < 1000) break;
      page++;
    }

    const { data: creditsData } = await adminClient.from("user_credits").select("user_id, credits, is_unlimited, plan, plan_started_at, plan_expires_at");
    const { data: projectsData } = await adminClient.from("story_projects").select("user_id");
    const { data: txData } = await adminClient.from("credit_transactions").select("user_id, amount, type");
    const { data: rolesData } = await adminClient.from("user_roles").select("user_id, role");

    let storageByUser: Record<string, number> = {};
    try {
      const { data: storageData } = await adminClient
        .from("objects" as any).select("owner, metadata").eq("bucket_id", "story-images");
      if (storageData) {
        for (const obj of storageData as any[]) {
          const ownerId = obj.owner;
          const size = obj.metadata?.size || obj.metadata?.contentLength || 0;
          if (ownerId) storageByUser[ownerId] = (storageByUser[ownerId] || 0) + Number(size);
        }
      }
    } catch (e) { console.error("Storage query error:", e); }

    const projectCounts: Record<string, number> = {};
    (projectsData || []).forEach((p: any) => { projectCounts[p.user_id] = (projectCounts[p.user_id] || 0) + 1; });

    const totalSpent: Record<string, number> = {};
    (txData || []).forEach((t: any) => { if (t.type === "debit") totalSpent[t.user_id] = (totalSpent[t.user_id] || 0) + Math.abs(t.amount); });

    const creditMap: Record<string, any> = {};
    (creditsData || []).forEach((c: any) => { creditMap[c.user_id] = c; });

    const adminSet = new Set<string>();
    (rolesData || []).forEach((r: any) => { if (r.role === "admin") adminSet.add(r.user_id); });

    const result = allUsers.map((u: any) => ({
      user_id: u.id,
      email: u.email || "",
      credits: creditMap[u.id]?.credits || 0,
      is_unlimited: creditMap[u.id]?.is_unlimited || false,
      created_at: u.created_at,
      project_count: projectCounts[u.id] || 0,
      total_spent: totalSpent[u.id] || 0,
      is_admin: adminSet.has(u.id),
      storage_bytes: storageByUser[u.id] || 0,
      plan: creditMap[u.id]?.plan || "free",
      plan_started_at: creditMap[u.id]?.plan_started_at || null,
      plan_expires_at: creditMap[u.id]?.plan_expires_at || null,
    }));

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
