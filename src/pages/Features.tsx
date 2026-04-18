import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppStore } from "@/lib/store";
import { Film, Mic, AudioLines, MessageSquare, Image, Video, Sparkles, ArrowRight, Layers, Captions, Wand2, Play } from "lucide-react";

const featuresContent = {
  en: {
    hero: {
      badge: "Three Powerful Modes",
      title: "Create Stories Your Way",
      desc: "Choose the creation mode that fits your vision. Each mode offers unique tools to bring your stories to life.",
    },
    modes: [
      {
        id: "storyboard",
        icon: Film,
        name: "Storyboard",
        tagline: "Visual stories with speech bubbles",
        description: "Create multi-frame visual stories with AI-generated images. Each frame can have speech bubbles with character dialogues that appear as overlays on the images. Static images are combined into a single video with timed transitions.",
        features: [
          { icon: Layers, text: "Multi-frame story generation (2-8 frames)" },
          { icon: MessageSquare, text: "Speech bubbles with character dialogues" },
          { icon: Image, text: "AI-generated images for each scene" },
          { icon: Video, text: "Automatic video compilation with transitions" },
        ],
        workflow: [
          "Write your story topic or fill frames individually",
          "AI generates a story draft with scenes & dialogues",
          "Generate images for each frame with character consistency",
          "Add speech bubbles and text overlays",
          "Compile into a video with timed transitions",
        ],
      },
      {
        id: "animation",
        icon: Mic,
        name: "Animation",
        tagline: "Animated videos with lip-sync",
        description: "Transform static images into animated videos. Each frame is animated using AI video models, creating smooth motion from still images. Select from multiple animation models optimized for different use cases — from cinematic storytelling to character lip-sync.",
        features: [
          { icon: Wand2, text: "AI-powered image-to-video animation" },
          { icon: Layers, text: "Multiple AI models (V1-V4) for different styles" },
          { icon: Captions, text: "Subtitle support with customizable styles" },
          { icon: Video, text: "Merge all animated clips into one video" },
        ],
        workflow: [
          "Create your story and generate images",
          "Animate each frame using AI video models",
          "Choose the model that fits your scene best",
          "Add subtitles with custom fonts and colors",
          "Merge all animations into a final video",
        ],
      },
      {
        id: "voiceover",
        icon: AudioLines,
        name: "Voice Over",
        tagline: "Narrated stories with synced subtitles",
        description: "Add professional AI voiceover to your visual stories. Write narration for each frame, choose from multiple AI voices, and the platform generates audio synchronized with your images. Subtitles appear word-by-word in sync with the narration.",
        features: [
          { icon: AudioLines, text: "AI text-to-speech with multiple voice options" },
          { icon: Captions, text: "Word-by-word synced subtitles" },
          { icon: Image, text: "Ken Burns effect on still images" },
          { icon: Wand2, text: "Animation support for each frame" },
        ],
        workflow: [
          "Create your story and generate images",
          "Write narration text for each frame",
          "Select an AI voice for the narration",
          "Optionally animate frames with AI video models",
          "Generate video with synced voiceover and subtitles",
        ],
      },
    ],
    cta: {
      title: "Ready to start creating?",
      desc: "Pick a mode and bring your first story to life.",
      button: "Get Started Free",
    },
    modalVideo: "Example video coming soon",
  },
  tr: {
    hero: {
      badge: "Üç Güçlü Mod",
      title: "Hikayelerini İstediğin Şekilde Oluştur",
      desc: "Vizyonunuza uygun oluşturma modunu seçin. Her mod, hikayelerinizi hayata geçirmek için benzersiz araçlar sunar.",
    },
    modes: [
      {
        id: "storyboard",
        icon: Film,
        name: "Storyboard",
        tagline: "Konuşma balonlu görsel hikayeler",
        description: "AI tarafından üretilen görsellerle çok kareli görsel hikayeler oluşturun. Her karede görsel üzerine yerleştirilen konuşma balonları ile karakter diyalogları ekleyin. Statik görseller zamanlı geçişlerle tek bir videoya dönüştürülür.",
        features: [
          { icon: Layers, text: "Çok kareli hikaye üretimi (2-8 kare)" },
          { icon: MessageSquare, text: "Karakter diyaloglu konuşma balonları" },
          { icon: Image, text: "Her sahne için AI üretimli görseller" },
          { icon: Video, text: "Geçişli otomatik video derleme" },
        ],
        workflow: [
          "Hikaye konunuzu yazın veya kareleri tek tek doldurun",
          "AI, sahneler ve diyaloglarla bir taslak oluşturur",
          "Karakter tutarlılığıyla her kare için görsel üretin",
          "Konuşma balonları ve metin katmanları ekleyin",
          "Zamanlı geçişlerle videoya derleyin",
        ],
      },
      {
        id: "animation",
        icon: Mic,
        name: "Animation",
        tagline: "Dudak senkronlu animasyonlu videolar",
        description: "Statik görselleri animasyonlu videolara dönüştürün. Her kare, AI video modelleri kullanılarak canlandırılır. Sinematik anlatımdan karakter dudak senkronizasyonuna kadar farklı kullanım alanlarına özel birden fazla model arasından seçim yapın.",
        features: [
          { icon: Wand2, text: "AI destekli görsel-video animasyonu" },
          { icon: Layers, text: "Farklı stiller için birden fazla AI model (V1-V4)" },
          { icon: Captions, text: "Özelleştirilebilir alt yazı desteği" },
          { icon: Video, text: "Tüm klipleri tek videoda birleştirme" },
        ],
        workflow: [
          "Hikayenizi oluşturup görselleri üretin",
          "AI video modelleriyle her kareyi canlandırın",
          "Sahnenize en uygun modeli seçin",
          "Özel font ve renklerle alt yazı ekleyin",
          "Tüm animasyonları final videoda birleştirin",
        ],
      },
      {
        id: "voiceover",
        icon: AudioLines,
        name: "Voice Over",
        tagline: "Senkron alt yazılı seslendirilmiş hikayeler",
        description: "Görsel hikayelerinize profesyonel AI seslendirme ekleyin. Her kare için anlatım metni yazın, çoklu AI sesleri arasından seçin. Alt yazılar seslendirmeyle kelime kelime senkronize şekilde görüntülenir.",
        features: [
          { icon: AudioLines, text: "Çoklu ses seçenekli AI metin-konuşma" },
          { icon: Captions, text: "Kelime kelime senkron alt yazılar" },
          { icon: Image, text: "Görsellerde Ken Burns efekti" },
          { icon: Wand2, text: "Her kare için animasyon desteği" },
        ],
        workflow: [
          "Hikayenizi oluşturup görselleri üretin",
          "Her kare için anlatım metni yazın",
          "Seslendirme için AI sesi seçin",
          "İsteğe bağlı olarak kareleri AI ile canlandırın",
          "Senkron seslendirme ve alt yazıyla video oluşturun",
        ],
      },
    ],
    cta: {
      title: "Oluşturmaya hazır mısınız?",
      desc: "Bir mod seçin ve ilk hikayenizi hayata geçirin.",
      button: "Ücretsiz Başla",
    },
    modalVideo: "Örnek video yakında eklenecek",
  },
};

const accentColors = [
  "from-primary/10 to-accent/10",
  "from-accent/10 to-primary/10",
  "from-primary/10 to-accent/10",
];

export default function Features() {
  const navigate = useNavigate();
  const { language } = useAppStore();
  const txt = featuresContent[language];
  const [openModal, setOpenModal] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicNavbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/8 via-primary/5 to-transparent pointer-events-none" />
          <div className="mx-auto max-w-4xl px-4 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium border border-accent/20">
              {txt.hero.badge}
            </Badge>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] mb-5 brand-gradient-text">
              {txt.hero.title}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {txt.hero.desc}
            </p>
          </div>
        </section>

        {/* Modes */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-20 space-y-16">
          {txt.modes.map((mode, idx) => {
            const Icon = mode.icon;
            const isReversed = idx % 2 === 1;

            return (
              <div key={mode.id} className={`grid gap-8 md:grid-cols-2 items-center ${isReversed ? "md:direction-rtl" : ""}`}>
                {/* Text content */}
                <div className={`space-y-6 ${isReversed ? "md:order-2" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${accentColors[idx]}`}>
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">{mode.name}</h2>
                      <p className="text-sm text-muted-foreground">{mode.tagline}</p>
                    </div>
                  </div>

                  <p className="text-muted-foreground leading-relaxed">{mode.description}</p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {mode.features.map((feat, fi) => {
                      const FIcon = feat.icon;
                      return (
                        <div key={fi} className="flex items-start gap-2.5">
                          <FIcon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span className="text-sm text-foreground">{feat.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Workflow card */}
                <div className={isReversed ? "md:order-1" : ""}>
                  <Card className="modern-shell overflow-hidden">
                    <CardContent className="p-0">
                      {/* Mock video area */}
                      <button
                        onClick={() => setOpenModal(mode.id)}
                        className="w-full aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center group cursor-pointer hover:from-primary/5 hover:to-accent/5 transition-colors"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                            <Play className="h-6 w-6 text-primary ml-0.5" />
                          </div>
                          <span className="text-xs text-muted-foreground">{txt.modalVideo}</span>
                        </div>
                      </button>
                      {/* Workflow steps */}
                      <div className="p-5 space-y-2.5">
                        {mode.workflow.map((step, si) => (
                          <div key={si} className="flex items-start gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {si + 1}
                            </span>
                            <span className="text-sm text-muted-foreground pt-0.5">{step}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })}
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-gradient-to-b from-muted/30 to-accent/5">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold brand-gradient-text mb-3">{txt.cta.title}</h2>
            <p className="text-muted-foreground mb-6">{txt.cta.desc}</p>
            <Button size="lg" onClick={() => navigate("/auth")} className="h-11 px-8 gap-2 brand-gradient-bg text-white border-0 hover:opacity-90 playful-shadow">
              <Sparkles className="h-4 w-4" />
              {txt.cta.button}
            </Button>
          </div>
        </section>
      </main>

      {/* Video modal */}
      <Dialog open={!!openModal} onOpenChange={() => setOpenModal(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {openModal && txt.modes.find(m => m.id === openModal)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Play className="h-10 w-10" />
              <span className="text-sm">{txt.modalVideo}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {openModal && txt.modes.find(m => m.id === openModal)?.tagline}
          </p>
        </DialogContent>
      </Dialog>

      <PublicFooter />
    </div>
  );
}
