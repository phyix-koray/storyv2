import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Package, Trash2, Edit3, Check, X, Upload, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { uploadAssetToStorage, getSignedUrl } from "@/lib/projectStorage";

interface SavedObject {
  id: string;
  description: string;
  image_url: string;
  _signedUrl?: string;
}

export default function Objects() {
  const { language } = useAppStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [objects, setObjects] = useState<SavedObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");

  const resolveSignedUrls = async (objs: SavedObject[]): Promise<SavedObject[]> => {
    return Promise.all(
      objs.map(async (o) => {
        const url = await getSignedUrl(o.image_url);
        return { ...o, _signedUrl: url || o.image_url };
      })
    );
  };

  const fetchObjects = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await (supabase.from("saved_objects") as any).select("id, description, image_url").eq("user_id", user.id).order("created_at", { ascending: false });
    const resolved = await resolveSignedUrls(data || []);
    setObjects(resolved);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchObjects(); }, [fetchObjects]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const storagePath = await uploadAssetToStorage({ data: file, userId: user.id, folder: "objects" });
      if (!storagePath) {
        toast.error(language === "tr" ? "Yükleme başarısız" : "Upload failed");
        continue;
      }
      const desc = file.name.replace(/\.[^.]+$/, "");
      await (supabase.from("saved_objects") as any).insert({ user_id: user.id, description: desc, image_url: storagePath });
    }
    fetchObjects();
    toast.success(language === "tr" ? "Obje yüklendi" : "Object uploaded");
  };

  const handleDelete = async (id: string) => {
    await (supabase.from("saved_objects") as any).delete().eq("id", id);
    setObjects(objects.filter(o => o.id !== id));
  };

  const handleSaveEdit = async (id: string) => {
    await (supabase.from("saved_objects") as any).update({ description: editDesc }).eq("id", id);
    setObjects(objects.map(o => o.id === id ? { ...o, description: editDesc } : o));
    setEditingId(null);
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
                <Package className="h-5 w-5 text-primary" />
                <h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-xl font-bold tracking-tight text-transparent">{t(language, "objects")}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1">
                  <Upload className="h-3.5 w-3.5" />
                  {t(language, "uploadFromComputer")}
                </Button>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
                <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                  {t(language, "home")}
                </Button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-5xl px-4 py-6">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : objects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground mb-4">{t(language, "noObjectsYet")}</p>
                <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="h-4 w-4" />
                  {t(language, "uploadFromComputer")}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {objects.map((obj) => (
                  <Card key={obj.id} className="modern-shell overflow-hidden group">
                    <div className="flex aspect-square items-center justify-center bg-muted">
                      {(obj._signedUrl || obj.image_url) && <img src={obj._signedUrl || obj.image_url} alt={obj.description} className="h-full w-full object-cover" loading="lazy" />}
                    </div>
                    <CardContent className="p-3 space-y-2 min-h-0">
                      {editingId === obj.id ? (
                        <div className="space-y-2">
                          <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="h-8 text-sm" autoFocus placeholder={t(language, "objectDescription")} />
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveEdit(obj.id)}><Check className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-center truncate">{obj.description || "—"}</p>
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => { setEditingId(obj.id); setEditDesc(obj.description); }}>
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(obj.id)}>
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
