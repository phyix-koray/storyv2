import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { FileText, Trash2, Edit3, Check, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { extractStoryImagePath, getSignedUrl } from "@/lib/projectStorage";

interface SavedTemplate {
  id: string;
  name: string;
  story_language: string;
  story_topic: string;
  frame_count: number | null;
  art_style: string;
  image_format: string;
  per_frame_mode: boolean;
  frame_prompts: string[];
  use_character_avatars: boolean;
  character_ids?: { name: string; features?: string; base64?: string; imageUrl?: string }[];
  object_ids?: { description: string; base64?: string; imageUrl?: string }[];
}

export default function Templates() {
  const {
    language,
    setStoryLanguage,
    setStoryTopic,
    setFrameCount,
    setArtStyle,
    setImageFormat,
    setUseCharacterAvatars,
    setPerFrameMode,
    setFramePrompts,
    setCharacterAvatars,
  } = useAppStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const setCharacters = (nextCharacters: any[]) => {
    const store = useAppStore.getState();
    store.characters.forEach((c) => store.removeCharacter(c.id));
    nextCharacters.forEach((c) => store.addCharacter(c));
  };

  const setObjectAssets = (assets: any[]) => {
    const store = useAppStore.getState();
    store.objectAssets.forEach((a) => store.removeObjectAsset(a.id));
    assets.forEach((a) => store.addObjectAsset(a));
  };

  const fetchTemplates = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await (supabase.from("story_templates") as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setTemplates((data || []).map((t: any) => ({
      ...t,
      frame_prompts: t.frame_prompts || [],
      character_ids: t.character_ids || [],
      object_ids: t.object_ids || [],
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleDelete = async (id: string) => {
    await (supabase.from("story_templates") as any).delete().eq("id", id);
    setTemplates(templates.filter(t => t.id !== id));
    toast.success(language === "tr" ? "Şablon silindi" : "Template deleted");
  };

  const handleSaveEdit = async (id: string) => {
    await (supabase.from("story_templates") as any).update({ name: editName }).eq("id", id);
    setTemplates(templates.map(t => t.id === id ? { ...t, name: editName } : t));
    setEditingId(null);
  };

  const applyTemplate = async (tpl: SavedTemplate) => {
    setStoryLanguage(tpl.story_language || "tr");
    setStoryTopic(tpl.story_topic || "");
    if (tpl.frame_count) setFrameCount(tpl.frame_count);
    setArtStyle(tpl.art_style || "default");
    setImageFormat((tpl.image_format || "square") as any);
    setUseCharacterAvatars(tpl.use_character_avatars ?? true);
    if (tpl.per_frame_mode) {
      setPerFrameMode(true);
      setFramePrompts(tpl.frame_prompts || []);
    } else {
      setPerFrameMode(false);
    }

    toast.success(language === "tr" ? "Şablon uygulanıyor, görseller yükleniyor..." : "Applying template, loading images...");

    const resolveUrl = async (raw?: string): Promise<string> => {
      const stored = raw || "";
      if (!stored) return "";
      if ((stored.startsWith("http://") || stored.startsWith("https://")) && !extractStoryImagePath(stored)) return stored;
      if (stored.startsWith("data:")) return stored;
      const signed = await getSignedUrl(stored);
      return signed || stored;
    };

    if (tpl.character_ids && tpl.character_ids.length > 0) {
      const resolved = await Promise.all(
        tpl.character_ids.map(async (c) => ({
          name: c.name,
          features: c.features || "",
          previewUrl: await resolveUrl(c.imageUrl || c.base64),
        })),
      );
      setCharacterAvatars(
        resolved.map((c) => ({
          name: c.name,
          features: c.features,
          imageUrl: c.previewUrl,
          generating: false,
        })),
      );
      setCharacters(
        resolved.map((c) => ({
          id: crypto.randomUUID(),
          file: new File([], `${c.name || "character"}.png`),
          previewUrl: c.previewUrl,
          role: c.name || "",
          imageUrl: c.previewUrl,
        })),
      );
    }

    if (tpl.object_ids && tpl.object_ids.length > 0) {
      const resolved = await Promise.all(
        tpl.object_ids.map(async (o) => ({
          description: o.description || "",
          previewUrl: await resolveUrl(o.imageUrl || o.base64),
        })),
      );
      setObjectAssets(
        resolved.map((o) => ({
          id: crypto.randomUUID(),
          file: new File([], "template-object.png"),
          previewUrl: o.previewUrl,
          description: o.description,
          imageUrl: o.previewUrl,
        })),
      );
    }

    toast.success(language === "tr" ? "Şablon uygulandı" : "Template applied");
    navigate("/");
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-transparent">
        <AppSidebar />
        <SidebarInset>
          <header className="border-b border-border/70 bg-background/70 backdrop-blur-xl">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <FileText className="h-5 w-5 text-primary" />
                <h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-xl font-bold tracking-tight text-transparent">
                  {language === "tr" ? "Şablonlar" : "Templates"}
                </h1>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                {t(language, "home")}
              </Button>
            </div>
          </header>

          <main className="mx-auto max-w-5xl px-4 py-6">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground mb-4">
                  {language === "tr" ? "Henüz şablon yok. Form ekranından şablon kaydedebilirsiniz." : "No templates yet. Save a template from the form screen."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {templates.map((tpl) => (
                  <Card key={tpl.id} className="modern-shell overflow-hidden group cursor-pointer hover:border-primary/50 transition-colors" onClick={() => applyTemplate(tpl)}>
                    <CardContent className="p-4 space-y-2">
                      {editingId === tpl.id ? (
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" autoFocus />
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveEdit(tpl.id)}><Check className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{tpl.name}</p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {tpl.story_topic || (tpl.per_frame_mode ? (language === "tr" ? "Kare bazlı mod" : "Per-frame mode") : "—")}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] rounded bg-muted px-1.5 py-0.5">{tpl.art_style}</span>
                            <span className="text-[10px] rounded bg-muted px-1.5 py-0.5">{tpl.image_format}</span>
                            {tpl.frame_count && <span className="text-[10px] rounded bg-muted px-1.5 py-0.5">{tpl.frame_count} kare</span>}
                          </div>
                          <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => { setEditingId(tpl.id); setEditName(tpl.name); }}>
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(tpl.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}