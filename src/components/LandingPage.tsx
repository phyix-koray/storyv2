import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, Heart, Eye, Play, Globe } from "lucide-react";
import storiLyneLogo from "@/assets/storilyne-logo.png";
import { PublicFooter } from "@/components/PublicFooter";
import { useAppStore } from "@/lib/store";

import story1 from "@/assets/mock/story1.jpg";
import story2 from "@/assets/mock/story2.jpg";
import story3 from "@/assets/mock/story3.jpg";
import story4 from "@/assets/mock/story4.jpg";
import story5 from "@/assets/mock/story5.jpg";
import story6 from "@/assets/mock/story6.jpg";
import story7 from "@/assets/mock/story7.jpg";
import story8 from "@/assets/mock/story8.jpg";
import story9 from "@/assets/mock/story9.jpg";
import story10 from "@/assets/mock/story10.jpg";
import story11 from "@/assets/mock/story11.jpg";
import story12 from "@/assets/mock/story12.jpg";

interface MockStory {
  id: string;
  title: string;
  author: string;
  image: string;
  likes: number;
  views: number;
  style: string;
  isVideo?: boolean;
}

const MOCK_STORIES: MockStory[] = [
  { id: "1", title: "The Brave Little Fox", author: "Sarah K.", image: story1, likes: 342, views: 1289, style: "Children's" },
  { id: "2", title: "Sakura Warrior", author: "Yuki M.", image: story2, likes: 891, views: 3450, style: "Anime", isVideo: true },
  { id: "3", title: "Neon Dreams", author: "Alex R.", image: story3, likes: 567, views: 2103, style: "Cyberpunk" },
  { id: "4", title: "Winter Cottage", author: "Emma L.", image: story4, likes: 423, views: 1567, style: "Watercolor" },
  { id: "5", title: "Dragon's Keep", author: "Marcus W.", image: story5, likes: 1205, views: 5670, style: "Fantasy", isVideo: true },
  { id: "6", title: "Garden Bot", author: "Lina P.", image: story6, likes: 298, views: 987, style: "3D Render" },
  { id: "7", title: "Ocean World", author: "David C.", image: story7, likes: 654, views: 2890, style: "Oil Painting" },
  { id: "8", title: "Sunflower Ride", author: "Hana T.", image: story8, likes: 789, views: 3120, style: "Ghibli" },
  { id: "9", title: "The Haunted Manor", author: "Chris B.", image: story9, likes: 456, views: 1890, style: "Gothic", isVideo: true },
  { id: "10", title: "Sky Captain", author: "Oliver N.", image: story10, likes: 321, views: 1450, style: "Steampunk" },
  { id: "11", title: "Space Explorer", author: "Mia J.", image: story11, likes: 567, views: 2340, style: "Children's" },
  { id: "12", title: "Rose Garden Princess", author: "Luna A.", image: story12, likes: 934, views: 4120, style: "Fantasy" },
];

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

const landingText = {
  tr: {
    signIn: "Giriş Yap",
    getStarted: "Başla",
    badge: "✨ AI Destekli Hikaye Oluşturma",
    heroTitle: "İlk Hikayeni Oluştur",
    heroDesc: "Fikirlerini AI ile etkileyici görsel hikayelere ve videolara dönüştür. Hayal gücünü hayata geçiren binlerce içerik üreticisine katıl.",
    heroCta: "Ücretsiz Kaydol",
    heroSub: "Kredi kartı gerekmez • Saniyeler içinde üretmeye başla",
    explore: "Topluluk Hikayelerini Keşfet",
    bottomTitle: "Kendi hikayeni oluşturmaya hazır mısın?",
    bottomDesc: "Topluluğa katıl ve bugün görsel hikayeler üretmeye başla.",
    bottomCta: "Ücretsiz Başla",
  },
  en: {
    signIn: "Sign In",
    getStarted: "Get Started",
    badge: "✨ AI-Powered Story Creation",
    heroTitle: "Create Your 1st Story",
    heroDesc: "Turn your ideas into stunning visual stories and videos with AI. Join thousands of creators bringing their imagination to life.",
    heroCta: "Sign Up — It's Free",
    heroSub: "No credit card required • Start creating in seconds",
    explore: "Explore Community Stories",
    bottomTitle: "Ready to create your own?",
    bottomDesc: "Join the community and start generating visual stories today.",
    bottomCta: "Get Started Free",
  },
};

export function LandingPage() {
  const navigate = useNavigate();
  const { language, setLanguage } = useAppStore();
  const txt = landingText[language];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src={storiLyneLogo} alt="Storilyne" className="h-8 object-contain" />
          </div>
          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <button
              onClick={() => setLanguage(language === "tr" ? "en" : "tr")}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={language === "tr" ? "Switch to English" : "Türkçe'ye geç"}
            >
              <Globe className="h-3.5 w-3.5" />
              {language === "tr" ? "EN" : "TR"}
            </button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-muted-foreground">
              {txt.signIn}
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")} className="gap-1.5">
              {txt.getStarted} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/8 via-primary/5 to-transparent pointer-events-none" />
        <div className="mx-auto max-w-4xl px-4 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium border border-accent/20">
            {txt.badge}
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.1] mb-5 brand-gradient-text">
            {txt.heroTitle}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            {txt.heroDesc}
          </p>
          <Button size="lg" onClick={() => navigate("/auth")} className="h-12 px-8 text-base font-semibold gap-2 brand-gradient-bg text-white border-0 shadow-lg playful-shadow hover:opacity-90 transition-opacity">
            <Sparkles className="h-4.5 w-4.5" />
            {txt.heroCta}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">{txt.heroSub}</p>
        </div>
      </section>

      {/* Section label */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">{txt.explore}</h2>
          <div className="flex-1 h-px bg-border" />
        </div>
      </div>

      {/* Masonry Grid */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-20">
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-4">
          {MOCK_STORIES.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border bg-gradient-to-b from-muted/30 to-accent/5">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold brand-gradient-text mb-3">{txt.bottomTitle}</h2>
          <p className="text-muted-foreground mb-6">{txt.bottomDesc}</p>
          <Button size="lg" onClick={() => navigate("/auth")} className="h-11 px-8 gap-2 brand-gradient-bg text-white border-0 hover:opacity-90 playful-shadow">
            <Sparkles className="h-4 w-4" />
            {txt.bottomCta}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}

function StoryCard({ story }: { story: MockStory }) {
  return (
    <div className="mb-3 sm:mb-4 break-inside-avoid group cursor-pointer">
      <div className="relative rounded-xl overflow-hidden bg-muted border border-border/50 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
        <img
          src={story.image}
          alt={story.title}
          className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
        {story.isVideo && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-background/80 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-foreground">
            <Play className="h-2.5 w-2.5 fill-current" /> Video
          </div>
        )}
        <div className="absolute top-2.5 right-2.5">
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-[10px] font-medium border-0">
            {story.style}
          </Badge>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <p className="text-white text-sm font-semibold truncate">{story.title}</p>
          <p className="text-white/70 text-xs">{story.author}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-white/60 text-[11px]">
              <Heart className="h-3 w-3" /> {formatCount(story.likes)}
            </span>
            <span className="flex items-center gap-1 text-white/60 text-[11px]">
              <Eye className="h-3 w-3" /> {formatCount(story.views)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
