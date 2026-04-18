import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Credits {
  credits: number;
  isUnlimited: boolean;
  loading: boolean;
  plan: string;
  refetch: () => Promise<void>;
}

export function useCredits(): Credits {
  const { user } = useAuth();
  const [credits, setCredits] = useState(0);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [plan, setPlan] = useState("free");
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("user_credits")
      .select("credits, is_unlimited, plan")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setCredits(data.credits);
      setIsUnlimited(data.is_unlimited);
      setPlan((data as any).plan || "free");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);

  return { credits, isUnlimited, loading, plan, refetch };
}
