import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { buildSignedImageUrlMap } from "@/lib/projectStorage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Image as ImageIcon, Trash2, Edit3, Eye, FolderPlus, Folder, ArrowLeft, Palette, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { TextOverlay, Dialogue } from "@/lib/types";

interface ProjectRow { id: string; story_topic: string; style: string; story_language: string; created_at: string; image_format?: string; folder_id?: string | null; story_mode?: string; }
interface FrameRow { id: string; project_id: string; frame_number: number; image_path: string | null; scene_description: string | null; image_url?: string; text_overlays?: any; dialogues?: any; }
interface VideoRow { id: string; project_id: string; video_url: string | null; frame_number?: number; }
interface FolderRow { id: string; name: string; color: string; }

const FOLDER_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#06b6d4",
];

export default function History() {
  const { user } = useAuth();
  const { language } = useAppStore();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [frames, setFrames] = useState<Record<string, FrameRow[]>>({});
  const [videos, setVideos] = useState<Record<string, VideoRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);

  useEffect(() => { if (!user) { setLoading(false); return; } loadAll(); }, [user]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadProjects(), loadFolders()]);
    setLoading(false);
  };

  const loadFolders = async () => {
    const { data } = await (supabase.from("story_folders") as any).select("id, name, color").order("created_at");
    setFolders(data || []);
  };

  const loadProjects = async () => {
    const { data } = await supabase.from("story_projects").select("*").order("created_at", { ascending: false }).limit(50) as { data: ProjectRow[] | null };
    if (!data) return;
    setProjects(data);
    const projectIds = data.map((p) => p.id);
    if (projectIds.length === 0) { setFrames({}); setVideos({}); return; }
    
    // Load frames and videos in parallel
    const [framesResult, videosResult] = await Promise.all([
      supabase.from("project_frames").select("*").in("project_id", projectIds).order("frame_number") as unknown as Promise<{ data: FrameRow[] | null }>,
      supabase.from("project_videos").select("*").in("project_id", projectIds) as unknown as Promise<{ data: VideoRow[] | null }>,
    ]);

    const framesData = framesResult.data;
    if (framesData) {
      const imagePaths = framesData.map((f) => f.image_path).filter((p): p is string => !!p);
      const signedMap = await buildSignedImageUrlMap(imagePaths);
      const grouped: Record<string, FrameRow[]> = {};
      for (const frame of framesData) {
        const enriched: FrameRow = { ...frame, image_url: frame.image_path ? signedMap[frame.image_path] : undefined };
        if (!grouped[frame.project_id]) grouped[frame.project_id] = [];
        grouped[frame.project_id].push(enriched);
      }
      setFrames(grouped);
    }

    const videosData = videosResult.data;
    if (videosData) {
      const groupedVideos: Record<string, VideoRow[]> = {};
      for (const video of videosData) {
        if (!groupedVideos[video.project_id]) groupedVideos[video.project_id] = [];
        groupedVideos[video.project_id].push(video);
      }
      setVideos(groupedVideos);
    }
  };

  const handleDelete = async (projectId: string) => {
    try {
      await supabase.from("project_frames").delete().eq("project_id", projectId);
      await supabase.from("project_videos").delete().eq("project_id", projectId);
      await supabase.from("story_projects").delete().eq("id", projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      const newFrames = { ...frames }; delete newFrames[projectId]; setFrames(newFrames);
      toast.success(language === "tr" ? "Proje silindi" : "Project deleted");
    } catch (err) { console.error(err); toast.error(t(language, "error")); }
    setDeleteId(null);
  };

  const handleRename = async () => {
    if (!renameId || !renameText.trim()) return;
    try {
      await supabase.from("story_projects").update({ story_topic: renameText.trim() }).eq("id", renameId);
      setProjects((prev) => prev.map((p) => (p.id === renameId ? { ...p, story_topic: renameText.trim() } : p)));
      toast.success(language === "tr" ? "İsim güncellendi" : "Name updated");
    } catch (err) { console.error(err); toast.error(t(language, "error")); }
    setRenameId(null); setRenameText("");
  };

  const handleOpenProject = (project: ProjectRow) => {
    const projectFrames = frames[project.id] || [];
    const store = useAppStore.getState();
    store.setStoryTopic(project.story_topic);
    store.setArtStyle(project.style || "default");
    store.setStoryLanguage(project.story_language || "tr");
    store.setImageFormat((project.image_format as any) || "square");
    store.setCurrentProjectId(project.id);
    
    const mode = (project.story_mode as any) || "multi";
    store.setStoryMode(mode);

    const restoredScenes = projectFrames.map((f) => {
      let dialogues: Dialogue[] = [{ character: "", text: "" }];
      if (f.dialogues) {
        try {
          const parsed = typeof f.dialogues === "string" ? JSON.parse(f.dialogues) : f.dialogues;
          if (Array.isArray(parsed) && parsed.length > 0) dialogues = parsed;
        } catch {}
      }
      let shot_breakdown = undefined;
      if ((f as any).shot_breakdown) {
        try {
          const sb = typeof (f as any).shot_breakdown === "string" ? JSON.parse((f as any).shot_breakdown) : (f as any).shot_breakdown;
          if (sb && typeof sb === "object") shot_breakdown = sb;
        } catch {}
      }
      return { id: crypto.randomUUID(), number: f.frame_number, description: f.scene_description || "", dialogues, shot_breakdown, narration: (f as any).narration || undefined };
    });
    store.setScenes(restoredScenes);

    const restoredImages = projectFrames.map((f) => {
      let textOverlays: TextOverlay[] = [];
      if (f.text_overlays) {
        try {
          const parsed = typeof f.text_overlays === "string" ? JSON.parse(f.text_overlays) : f.text_overlays;
          if (Array.isArray(parsed)) textOverlays = parsed;
        } catch {}
      }
      const dur = (f as any).duration;
      return {
        sceneId: restoredScenes.find((s) => s.number === f.frame_number)?.id || "",
        imageUrl: f.image_url || "",
        approved: false,
        generating: false,
        textOverlays,
        duration: typeof dur === "number" && dur > 0 ? dur : 3,
      };
    });
    store.setImages(restoredImages);

    // Restore per-frame videos for voiceAnimation mode
    const projectVideos = videos[project.id] || [];
    const videoMap: Record<number, string> = {};
    const animMap: Record<number, string[]> = {};
    for (const v of projectVideos) {
      if (v.video_url && (v as any).frame_number != null) {
        const fn = (v as any).frame_number as number;
        if (fn >= 1000) {
          // Animation video (frame_number = 1000 + actual_frame)
          const actualFrame = fn - 1000;
          if (!animMap[actualFrame]) animMap[actualFrame] = [];
          animMap[actualFrame].push(v.video_url);
        } else {
          videoMap[fn] = v.video_url;
        }
      }
    }
    store.setRestoredVideos(videoMap);
    store.setRestoredAnimations(animMap);

    // Set correct step based on mode
    if (mode === "voiceAnimation" || mode === "bgVocal") {
      store.setStep(3);
    } else {
      store.setStep(3);
    }
    navigate("/");
  };

  // Folder operations
  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim()) return;
    await (supabase.from("story_folders") as any).insert({ user_id: user.id, name: newFolderName.trim() });
    setNewFolderOpen(false);
    setNewFolderName("");
    loadFolders();
  };

  const handleDeleteFolder = async (folderId: string) => {
    // Move projects out first
    await supabase.from("story_projects").update({ folder_id: null } as any).eq("folder_id", folderId);
    await (supabase.from("story_folders") as any).delete().eq("id", folderId);
    setFolders(folders.filter(f => f.id !== folderId));
    setProjects(projects.map(p => p.folder_id === folderId ? { ...p, folder_id: null } : p));
    if (activeFolderId === folderId) setActiveFolderId(null);
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!editFolderName.trim()) return;
    await (supabase.from("story_folders") as any).update({ name: editFolderName.trim() }).eq("id", folderId);
    setFolders(folders.map(f => f.id === folderId ? { ...f, name: editFolderName.trim() } : f));
    setEditFolderId(null);
  };

  const handleFolderColor = async (folderId: string, color: string) => {
    await (supabase.from("story_folders") as any).update({ color }).eq("id", folderId);
    setFolders(folders.map(f => f.id === folderId ? { ...f, color } : f));
  };

  const handleDrop = async (folderId: string | null) => {
    if (!dragProjectId) return;
    await supabase.from("story_projects").update({ folder_id: folderId } as any).eq("id", dragProjectId);
    setProjects(projects.map(p => p.id === dragProjectId ? { ...p, folder_id: folderId } : p));
    setDragProjectId(null);
  };

  const filteredProjects = activeFolderId
    ? projects.filter(p => p.folder_id === activeFolderId)
    : projects.filter(p => !p.folder_id);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-transparent">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/70 backdrop-blur-xl">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                {activeFolderId && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveFolderId(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  {activeFolderId ? folders.find(f => f.id === activeFolderId)?.name || (language === "tr" ? "Hikayeler" : "Stories") : (language === "tr" ? "Hikayeler" : "Stories")}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)} className="gap-1">
                  <FolderPlus className="h-3.5 w-3.5" />
                  {language === "tr" ? "Klasör Oluştur" : "New Folder"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/")}>{language === "tr" ? "Ana Sayfa" : "Home"}</Button>
              </div>
            </div>
          </header>

          <ContextMenu>
            <ContextMenuTrigger asChild>
              <main className="mx-auto max-w-5xl px-4 py-6 min-h-[60vh]">
                {/* Folders */}
                {!activeFolderId && folders.length > 0 && (
                  <div className="mb-6 flex flex-wrap gap-3">
                    {folders.map((folder) => (
                      <ContextMenu key={folder.id}>
                        <ContextMenuTrigger>
                          <div
                            className="flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors min-w-[140px]"
                            style={{ borderColor: folder.color + "40" }}
                            onClick={() => setActiveFolderId(folder.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(folder.id)}
                          >
                            <Folder className="h-5 w-5" style={{ color: folder.color }} />
                            <span className="text-sm font-medium truncate">{folder.name}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {projects.filter(p => p.folder_id === folder.id).length}
                            </span>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem onClick={() => { setEditFolderId(folder.id); setEditFolderName(folder.name); }}>
                            <Edit3 className="mr-2 h-3.5 w-3.5" />
                            {language === "tr" ? "Yeniden Adlandır" : "Rename"}
                          </ContextMenuItem>
                          {FOLDER_COLORS.map(c => (
                            <ContextMenuItem key={c} onClick={() => handleFolderColor(folder.id, c)}>
                              <div className="mr-2 h-3.5 w-3.5 rounded-full" style={{ backgroundColor: c }} />
                              <span className="text-xs">{c}</span>
                            </ContextMenuItem>
                          ))}
                          <ContextMenuItem className="text-destructive" onClick={() => handleDeleteFolder(folder.id)}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            {language === "tr" ? "Klasörü Sil" : "Delete Folder"}
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
                  </div>
                )}

                {/* Drop zone for removing from folder */}
                {activeFolderId && dragProjectId && (
                  <div
                    className="mb-4 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 py-4 text-sm text-muted-foreground"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {language === "tr" ? "Klasörden çıkar" : "Remove from folder"}
                  </div>
                )}

                {filteredProjects.length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground">{language === "tr" ? "Henüz proje yok" : "No projects yet"}</div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredProjects.map((project) => {
                      const projectFrames = frames[project.id] || [];
                      const projectVideos = videos[project.id] || [];
                      const firstFrame = projectFrames[0];
                      return (
                        <Card
                          key={project.id}
                          className="modern-shell group cursor-pointer overflow-hidden transition-all hover:ring-2 hover:ring-primary/50"
                          draggable
                          onDragStart={() => setDragProjectId(project.id)}
                          onDragEnd={() => setDragProjectId(null)}
                        >
                          <div className="relative flex aspect-video items-center justify-center bg-muted" onClick={() => handleOpenProject(project)}>
                            {firstFrame?.image_url ? <img src={firstFrame.image_url} alt="Proje önizlemesi" className="h-full w-full object-cover" loading="lazy" /> : <ImageIcon className="h-10 w-10 text-muted-foreground/40" />}
                            <div className="absolute inset-0 flex items-center justify-center bg-foreground/0 transition-colors group-hover:bg-foreground/15">
                              <Eye className="h-8 w-8 text-background opacity-0 transition-opacity group-hover:opacity-100" />
                            </div>
                          </div>
                          <CardContent className="p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Badge variant={project.story_mode === "single" ? "secondary" : "outline"} className={`text-[9px] px-1.5 py-0 ${project.story_mode === "voiceAnimation" ? "bg-violet-500/15 text-violet-600 border-violet-300" : project.story_mode === "bgVocal" ? "bg-emerald-500/15 text-emerald-600 border-emerald-300" : project.story_mode === "multi" ? "bg-blue-500/15 text-blue-600 border-blue-300" : ""}`}>
                                {project.story_mode === "voiceAnimation"
                                  ? (language === "tr" ? "Animasyon" : "Animation")
                                  : project.story_mode === "single"
                                    ? (language === "tr" ? "Tek Kare" : "Single Frame")
                                    : project.story_mode === "bgVocal"
                                      ? (language === "tr" ? "Seslendirme" : "Voice Over")
                                      : (language === "tr" ? "Storyboard" : "Storyboard")}
                              </Badge>
                            </div>
                            <p className="line-clamp-2 text-sm font-medium">{project.story_topic}</p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{project.style !== "default" ? project.style : ""}</span>
                              <span>{new Date(project.created_at).toLocaleDateString()}</span>
                              <span className="ml-auto flex items-center gap-1"><ImageIcon className="h-3 w-3" /> {projectFrames.length}</span>
                              {projectVideos.length > 0 && <span className="flex items-center gap-1"><Video className="h-3 w-3" /> {projectVideos.length}</span>}
                            </div>
                            <div className="mt-2 flex gap-2">
                              <Button size="icon" variant="outline" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setRenameId(project.id); setRenameText(project.story_topic); }}>
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="outline" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(project.id); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </main>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => setNewFolderOpen(true)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                {language === "tr" ? "Yeni Klasör Oluştur" : "Create New Folder"}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => navigate("/")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {language === "tr" ? "Ana Sayfaya Dön" : "Go to Home"}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => loadAll()}>
                <Eye className="mr-2 h-4 w-4" />
                {language === "tr" ? "Yenile" : "Refresh"}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </SidebarInset>
      </div>

      {/* Delete Project Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t(language, "confirmDelete")}</DialogTitle></DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteId(null)}>{t(language, "cancel")}</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>{t(language, "deleteProject")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Project Dialog */}
      <Dialog open={!!renameId} onOpenChange={() => setRenameId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t(language, "renameProject")}</DialogTitle></DialogHeader>
          <Input value={renameText} onChange={(e) => setRenameText(e.target.value)} placeholder={t(language, "projectName")} />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRenameId(null)}>{t(language, "cancel")}</Button>
            <Button onClick={handleRename}>{t(language, "save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{language === "tr" ? "Yeni Klasör" : "New Folder"}</DialogTitle></DialogHeader>
          <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder={language === "tr" ? "Klasör adı" : "Folder name"} autoFocus />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setNewFolderOpen(false)}>{t(language, "cancel")}</Button>
            <Button onClick={handleCreateFolder}>{t(language, "save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={!!editFolderId} onOpenChange={() => setEditFolderId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{language === "tr" ? "Klasörü Yeniden Adlandır" : "Rename Folder"}</DialogTitle></DialogHeader>
          <Input value={editFolderName} onChange={(e) => setEditFolderName(e.target.value)} autoFocus />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditFolderId(null)}>{t(language, "cancel")}</Button>
            <Button onClick={() => editFolderId && handleRenameFolder(editFolderId)}>{t(language, "save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
