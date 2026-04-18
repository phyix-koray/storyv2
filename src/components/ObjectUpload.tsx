import { useCallback, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Upload, X, History, ImagePlus, Check, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadAssetToStorage, getSignedUrl } from "@/lib/projectStorage";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface SavedObj { id: string; description: string; image_url: string; _signedUrl?: string; }

export function ObjectUpload() {
  const { language, objectAssets, addObjectAsset, removeObjectAsset, updateObjectAssetDescription } = useAppStore();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [savedObjs, setSavedObjs] = useState<SavedObj[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const resolveSignedUrls = async (objs: SavedObj[]): Promise<SavedObj[]> => {
    return Promise.all(
      objs.map(async (o) => {
        const url = await getSignedUrl(o.image_url);
        return { ...o, _signedUrl: url || o.image_url };
      })
    );
  };

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        let previewUrl = URL.createObjectURL(file);
        let imageUrl: string;
        if (user) {
          const storagePath = await uploadAssetToStorage({ data: file, userId: user.id, folder: "objects" });
          if (storagePath) {
            const signedUrl = await getSignedUrl(storagePath);
            previewUrl = signedUrl || previewUrl;
            imageUrl = storagePath;
          } else {
            imageUrl = await fileToBase64(file);
            previewUrl = imageUrl;
          }
        } else {
          imageUrl = await fileToBase64(file);
          previewUrl = imageUrl;
        }
        addObjectAsset({ id: crypto.randomUUID(), file, previewUrl, description: "", imageUrl });
      }
    },
    [addObjectAsset, user]
  );

  const loadSavedObjs = async () => {
    if (!user) return;
    const { data } = await (supabase.from("saved_objects") as any).select("id, description, image_url").eq("user_id", user.id).order("created_at", { ascending: false });
    const resolved = await resolveSignedUrls(data || []);
    setSavedObjs(resolved);
  };

  const handleOpenHistory = () => {
    setPopoverOpen(false);
    setSelectedIds(new Set());
    loadSavedObjs();
    setShowHistory(true);
  };

  const handleUploadClick = () => {
    setPopoverOpen(false);
    fileInputRef.current?.click();
  };

  const handlePasteFromClipboard = async () => {
    setPopoverOpen(false);
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const file = new File([blob], "pasted-image.png", { type: imageType });
        let previewUrl = URL.createObjectURL(file);
        let imageUrl: string;
        if (user) {
          const storagePath = await uploadAssetToStorage({ data: file, userId: user.id, folder: "objects" });
          if (storagePath) {
            const signedUrl = await getSignedUrl(storagePath);
            previewUrl = signedUrl || previewUrl;
            imageUrl = storagePath;
          } else {
            imageUrl = await fileToBase64(file);
            previewUrl = imageUrl;
          }
        } else {
          imageUrl = await fileToBase64(file);
          previewUrl = imageUrl;
        }
        addObjectAsset({ id: crypto.randomUUID(), file, previewUrl, description: "", imageUrl });
        toast.success(language === "tr" ? "Görsel yapıştırıldı" : "Image pasted");
        return;
      }
      toast.error(language === "tr" ? "Panoda görsel bulunamadı" : "No image found in clipboard");
    } catch {
      toast.error(language === "tr" ? "Pano erişimi başarısız" : "Clipboard access failed");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirmSelection = () => {
    for (const obj of savedObjs.filter((o) => selectedIds.has(o.id))) {
      const imageUrl = obj._signedUrl || obj.image_url;
      const blob = new Blob([], { type: "image/png" });
      const file = new File([blob], `${obj.description}.png`, { type: "image/png" });
      addObjectAsset({
        id: crypto.randomUUID(),
        file,
        previewUrl: imageUrl,
        description: obj.description,
        imageUrl: obj.image_url,
      });
    }
    setShowHistory(false);
  };

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">{t(language, "objectUpload")}</h3>
        <p className="text-xs text-muted-foreground">{t(language, "objectUploadDesc")}</p>
      </div>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <div role="button" tabIndex={-1} className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border p-4 transition-colors hover:border-primary/50 hover:bg-muted/50 outline-none focus:outline-none focus-visible:outline-none">
            <ImagePlus className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t(language, "objectUpload")}</span>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={handleUploadClick}>
              <Upload className="mr-2 h-3.5 w-3.5" />
              {t(language, "uploadFromComputer")}
            </Button>
            {user && (
              <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={handleOpenHistory}>
                <History className="mr-2 h-3.5 w-3.5" />
                {t(language, "fromHistory")}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={handlePasteFromClipboard}>
              <ClipboardPaste className="mr-2 h-3.5 w-3.5" />
              {language === "tr" ? "Panodan Yapıştır" : "Paste from Clipboard"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

      {objectAssets.length > 0 && (
        <div className="space-y-1.5">
          {objectAssets.map((asset) => (
            <div key={asset.id} className="flex items-center gap-2 rounded-md border p-1.5">
              <img src={asset.previewUrl} alt={asset.description || "object"} className="h-10 w-10 rounded object-cover" />
              <Input
                value={asset.description}
                onChange={(e) => updateObjectAssetDescription(asset.id, e.target.value)}
                placeholder={t(language, "objectDescPlaceholder")}
                className="h-7 flex-1 text-xs"
              />
              <Button variant="ghost" size="icon" onClick={() => removeObjectAsset(asset.id)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t(language, "fromHistory")}</DialogTitle>
          </DialogHeader>
          {savedObjs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t(language, "noObjectsYet")}</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {savedObjs.map((obj) => {
                  const selected = selectedIds.has(obj.id);
                  return (
                    <div
                      key={obj.id}
                      className={`cursor-pointer rounded-lg border-2 p-2 transition-colors ${selected ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted/50"}`}
                      onClick={() => toggleSelect(obj.id)}
                    >
                      <div className="relative aspect-square rounded overflow-hidden bg-muted mb-1">
                        {(obj._signedUrl || obj.image_url) && <img src={obj._signedUrl || obj.image_url} alt={obj.description} className="h-full w-full object-cover" />}
                        {selected && (
                          <div className="absolute top-1 right-1 rounded-full bg-primary p-0.5">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-medium text-center truncate">{obj.description}</p>
                    </div>
                  );
                })}
              </div>
              <Button onClick={handleConfirmSelection} disabled={selectedIds.size === 0} className="w-full mt-2">
                {language === "tr" ? `${selectedIds.size} obje ekle` : `Add ${selectedIds.size} object(s)`}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
