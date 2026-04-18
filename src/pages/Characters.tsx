import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Users, Trash2, Edit3, Check, X, Upload, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { uploadAssetToStorage, getSignedUrl } from "@/lib/projectStorage";

interface SavedCharacter {
  id: string;
  name: string;
  features: string;
  image_url: string; // storage path
  _signedUrl?: string; // resolved signed URL for display
}

export default function Characters() {
  const { language } = useAppStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [characters, setCharacters] = useState<SavedCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFeatures, setEditFeatures] = useState("");

  const resolveSignedUrls = async (chars: SavedCharacter[]): Promise<SavedCharacter[]> => {
    return Promise.all(
      chars.map(async (c) => {
        const url = await getSignedUrl(c.image_url);
        return { ...c, _signedUrl: url || c.image_url };
      })
    );
  };

  const fetchCharacters = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await (supabase.from("saved_characters") as any).select("id, name, features, image_url").eq("user_id", user.id).order("created_at", { ascending: false });
    const resolved = await resolveSignedUrls(data || []);
    setCharacters(resolved);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchCharacters(); }, [fetchCharacters]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const storagePath = await uploadAssetToStorage({ data: file, userId: user.id, folder: "characters" });
      if (!storagePath) {
        toast.error(language === "tr" ? "Yükleme başarısız" : "Upload failed");
        continue;
      }
      const name = file.name.replace(/\.[^.]+$/, "");
      await (supabase.from("saved_characters") as any).insert({ user_id: user.id, name, features: "", image_url: storagePath });
    }
    fetchCharacters();
    toast.success(language === "tr" ? "Karakter yüklendi" : "Character uploaded");
  };

  const handleDelete = async (id: string) => {
    await (supabase.from("saved_characters") as any).delete().eq("id", id);
    setCharacters(characters.filter(c => c.id !== id));
  };

  const handleSaveEdit = async (id: string) => {
    await (supabase.from("saved_characters") as any).update({ name: editName, features: editFeatures }).eq("id", id);
    setCharacters(characters.map(c => c.id === id ? { ...c, name: editName, features: editFeatures } : c));
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
                <Users className="h-5 w-5 text-primary" />
                <h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-xl font-bold tracking-tight text-transparent">{t(language, "characters")}</h1>
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
            ) : characters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Users className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground mb-4">{t(language, "noCharactersYet")}</p>
                <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="h-4 w-4" />
                  {t(language, "uploadFromComputer")}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {characters.map((char) => (
                  <Card key={char.id} className="modern-shell overflow-hidden group">
                    <div className="flex aspect-square items-center justify-center bg-muted">
                      {(char._signedUrl || char.image_url) && <img src={char._signedUrl || char.image_url} alt={char.name} className="h-full w-full object-cover" loading="lazy" />}
                    </div>
                    <CardContent className="p-3 space-y-2 min-h-0">
                      {editingId === char.id ? (
                        <div className="space-y-2">
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" autoFocus />
                          <Textarea value={editFeatures} onChange={(e) => setEditFeatures(e.target.value)} className="text-xs resize-y min-h-[50px]" rows={2} placeholder={t(language, "avatarFeaturesPlaceholder")} />
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveEdit(char.id)}><Check className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-center truncate">{char.name}</p>
                          {char.features && <p className="text-xs text-muted-foreground text-center truncate">{char.features}</p>}
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => { setEditingId(char.id); setEditName(char.name); setEditFeatures(char.features || ""); }}>
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(char.id)}>
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
