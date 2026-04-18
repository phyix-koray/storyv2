import { useState, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Edit3, Send, Check, Upload, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function CharacterAvatarStep() {
  const {
    language, characterAvatars, setCharacterAvatars, updateCharacterAvatar,
    artStyle,
    isGeneratingAvatars, setIsGeneratingAvatars,
    characters,
  } = useAppStore();
  const [revisionName, setRevisionName] = useState<string | null>(null);
  const [revisionText, setRevisionText] = useState("");
  // Auto-populate from uploaded characters with images
  const initialUploaded = () => {
    const map: Record<string, string> = {};
    for (const ch of characters) {
      const name = (ch.role || "").trim();
      const url = ch.imageUrl || ch.previewUrl || "";
      if (name && url) map[name] = url;
    }
    return map;
  };
  const [uploadedImages, setUploadedImages] = useState<Record<string, string>>(initialUploaded);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetName, setUploadTargetName] = useState<string | null>(null);

  const handleFileUpload = (name: string) => {
    setUploadTargetName(name);
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetName) return;
    
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    setUploadedImages(prev => ({ ...prev, [uploadTargetName]: dataUrl }));
    toast.success(language === "tr" ? "Görsel yüklendi. Avatar oluşturulduğunda bu görsel referans olarak kullanılacak." : "Image uploaded. It will be used as reference when generating avatar.");
    setUploadTargetName(null);
    e.target.value = "";
  };

  const removeUploadedImage = (name: string) => {
    setUploadedImages(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const generateAvatars = async (singleName?: string, revisionNote?: string) => {
    setIsGeneratingAvatars(true);
    if (singleName) {
      updateCharacterAvatar(singleName, { generating: true });
    }
    try {
      const currentAvatar = singleName ? characterAvatars.find((a) => a.name === singleName) : undefined;
      const mode = singleName ? (revisionNote?.trim() ? "revision" : "variation") : "initial";
      
      // Check if any character has an uploaded reference image
      const referenceImages: Record<string, string> = {};
      if (singleName && uploadedImages[singleName]) {
        referenceImages[singleName] = uploadedImages[singleName];
      } else if (!singleName) {
        for (const avatar of characterAvatars) {
          if (uploadedImages[avatar.name]) {
            referenceImages[avatar.name] = uploadedImages[avatar.name];
          }
        }
      }

      const { data, error } = await supabase.functions.invoke("generate-character-avatars", {
        body: {
          characterNames: singleName ? undefined : characterAvatars.map((a) => a.name),
          characterName: singleName,
          characterProfiles: singleName
            ? [{ name: singleName, features: currentAvatar?.name || singleName }]
            : characterAvatars.map((a) => ({ name: a.name, features: a.name })),
          artStyle,
          mode,
          revisionNote,
          referenceImage: singleName ? currentAvatar?.imageUrl : undefined,
          referenceImages, // uploaded images for nano-banana edit
        },
      });

      if (error) throw error;

      const normalizedAvatars = Array.isArray(data?.avatars)
        ? data.avatars
        : Object.entries(data?.avatars || {}).map(([name, url]) => ({ name, imageUrl: url }));

      if (singleName) {
        const avatar = normalizedAvatars.find((a: any) => a.name === singleName) || normalizedAvatars[0];
        if (avatar?.imageUrl) {
          updateCharacterAvatar(singleName, { imageUrl: avatar.imageUrl, generating: false });
        }
      } else {
        const avatars = characterAvatars.map((existing) => {
          const generated = normalizedAvatars.find((a: any) => a.name === existing.name);
          return {
            ...existing,
            imageUrl: generated?.imageUrl || "",
            generating: false,
          };
        });
        setCharacterAvatars(avatars);
      }
    } catch (err) {
      console.error(err);
      toast.error(t(language, "error"));
      if (singleName) {
        updateCharacterAvatar(singleName, { generating: false });
      }
    } finally {
      setIsGeneratingAvatars(false);
    }
  };

  const handleRevision = (name: string) => {
    if (!revisionText.trim()) return;
    generateAvatars(name, revisionText);
    setRevisionName(null);
    setRevisionText("");
  };

  const allGenerated = characterAvatars.every((a) => a.imageUrl && !a.generating);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t(language, "characterAvatars")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t(language, "characterAvatarsDesc")}</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFileChange}
      />

      {characterAvatars.length > 0 && characterAvatars[0].imageUrl ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {characterAvatars.map((avatar) => (
            <Card key={avatar.name} className="overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center">
                {avatar.generating ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : avatar.imageUrl ? (
                  <img src={avatar.imageUrl} alt={avatar.name} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <CardContent className="p-3 space-y-2">
                <p className="text-sm font-semibold text-center">{avatar.name}</p>

                {/* Uploaded reference indicator */}
                {uploadedImages[avatar.name] && (
                  <div className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 p-1.5">
                    <img src={uploadedImages[avatar.name]} alt="ref" className="h-8 w-8 rounded object-cover" />
                    <span className="text-[10px] text-muted-foreground flex-1">
                      {language === "tr" ? "Referans yüklendi" : "Reference uploaded"}
                    </span>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => removeUploadedImage(avatar.name)}>✕</Button>
                  </div>
                )}

                {revisionName === avatar.name ? (
                  <div className="space-y-2">
                    <Input
                      value={revisionText}
                      onChange={(e) => setRevisionText(e.target.value)}
                      placeholder={t(language, "avatarRevision")}
                      className="text-xs"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleRevision(avatar.name)} disabled={avatar.generating} className="flex-1">
                        <Send className="mr-1 h-3 w-3" />
                        {t(language, "sendRevision")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRevisionName(null)}>✕</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => generateAvatars(avatar.name)} disabled={avatar.generating} className="flex-1">
                      <RefreshCw className="mr-1 h-3 w-3" />
                      {t(language, "regenerateAvatar")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleFileUpload(avatar.name)} disabled={avatar.generating} title={language === "tr" ? "Görsel Yükle" : "Upload Image"}>
                      <Upload className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRevisionName(avatar.name)} disabled={avatar.generating}>
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Upload buttons before initial generation */}
          {characterAvatars.length > 0 && !isGeneratingAvatars && (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {characterAvatars.map((avatar) => (
                <Card key={avatar.name} className="overflow-hidden">
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    {uploadedImages[avatar.name] ? (
                      <div className="relative w-full h-full">
                        <img src={uploadedImages[avatar.name]} alt={avatar.name} className="h-full w-full object-cover" />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                          onClick={() => removeUploadedImage(avatar.name)}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                    )}
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <p className="text-sm font-semibold text-center">{avatar.name}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => handleFileUpload(avatar.name)}
                    >
                      <Upload className="mr-1 h-3 w-3" />
                      {language === "tr" ? "Görsel Yükle" : "Upload Image"}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      {language === "tr" ? "Opsiyonel: Referans görsel" : "Optional: Reference image"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex items-center justify-center py-6">
            {isGeneratingAvatars ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t(language, "generating")}</p>
              </div>
            ) : (
              <Button onClick={() => generateAvatars()} size="lg">
                {t(language, "generateAvatars")}
              </Button>
            )}
          </div>
        </div>
      )}

      {allGenerated && (
        <Button onClick={() => {
          useAppStore.getState().setStep(3);
        }} className="w-full" size="lg">
          <Check className="mr-2 h-4 w-4" />
          {t(language, "approveAvatars")}
        </Button>
      )}
    </div>
  );
}
