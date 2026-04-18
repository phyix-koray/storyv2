import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VIDEO_MODEL_PRICING_TABLE, MODEL_DESCRIPTIONS } from "@/lib/videoPricing";

const Pricing = () => {
  const { language } = useAppStore();
  const { user } = useAuth();
  const { credits, isUnlimited } = useCredits();
  const navigate = useNavigate();
  const tr = language === "tr";

  const creatorTiers = [
    {
      tabLabel: "9.90",
      name: "Starter",
      monthlyPrice: 9.9,
      description: tr ? "Hızlı başlangıç için en ekonomik paket." : "Most affordable package for a quick start.",
      features: tr ? [
        "Ayda 165 görsele kadar",
        "9 kısa video (5 sn, V2 720p, sesli)",
        "22 sesli anlatıma kadar (~300 kelime)",
        "Tüm görsel stilleri ve formatları dahil",
        "Standart render hızı",
      ] : [
        "Up to 165 images per month",
        "Up to 9 short videos (5 sec, V2 720p, with audio)",
        "Up to 22 voice narrations (~300 words each)",
        "All image styles and formats included",
        "Standard rendering speed",
      ],
      best: tr ? "Bireysel başlangıç ve hafif kullanım" : "Solo starters and light usage",
    },
    {
      tabLabel: "19.90",
      name: "Starter",
      monthlyPrice: 19.9,
      description: tr ? "AI hikaye oluşturmaya başlamak için ideal." : "Perfect for getting started with AI story creation.",
      features: tr ? [
        "Ayda 331 görsele kadar",
        "19 kısa video (5 sn, V2 720p, sesli)",
        "44 sesli anlatıma kadar (~300 kelime)",
        "Tüm görsel stilleri ve formatları dahil",
        "Standart render hızı",
      ] : [
        "Up to 331 images per month",
        "Up to 19 short videos (5 sec, V2 720p, with audio)",
        "Up to 44 voice narrations (~300 words each)",
        "All image styles and formats included",
        "Standard rendering speed",
      ],
      best: tr ? "Hobi kullanıcıları ve yeni başlayanlar için" : "Casual creators and early-stage users",
    },
    {
      tabLabel: "49.90",
      name: "Creator",
      monthlyPrice: 49.9,
      description: tr ? "Düzenli içerik üreten yaratıcılar için." : "For creators who publish consistently and need more flexibility.",
      features: tr ? [
        "Ayda 831 görsele kadar",
        "49 kısa video (5 sn, V2 720p, sesli)",
        "110 sesli anlatıma kadar (~300 kelime)",
        "Daha hızlı render",
        "Yoğun saatlerde öncelikli işlem",
      ] : [
        "Up to 831 images per month",
        "Up to 49 short videos (5 sec, V2 720p, with audio)",
        "Up to 110 voice narrations (~300 words each)",
        "Faster rendering speed",
        "Priority processing during peak times",
      ],
      best: tr ? "Aktif içerik üreticileri için" : "Active creators and storytellers",
    },
    {
      tabLabel: "199.90",
      name: "Growth",
      monthlyPrice: 199.9,
      description: tr ? "Profesyoneller ve yüksek hacimli üretim için." : "Built for professionals and high-volume content production.",
      features: tr ? [
        "Ayda 3331 görsele kadar",
        "199 kısa video (5 sn, V2 720p, sesli)",
        "444 sesli anlatıma kadar (~300 kelime)",
        "Hızlı render",
        "Öncelikli kuyruk erişimi",
        "Premium destek",
      ] : [
        "Up to 3331 images per month",
        "Up to 199 short videos (5 sec, V2 720p, with audio)",
        "Up to 444 voice narrations (~300 words each)",
        "Fast rendering speed",
        "Priority queue access",
        "Premium support",
      ],
      best: tr ? "Güçlü kullanıcılar, ekipler ve büyüyen işletmeler için" : "Power users, teams, and growing businesses",
    },
  ];

  const [selectedCreatorTab, setSelectedCreatorTab] = useState("49.90");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const activeCreatorTier = creatorTiers.find(t => t.tabLabel === selectedCreatorTab) || creatorTiers[1];

  const creatorPrice = useMemo(() => {
    const discounted = billingCycle === "yearly" ? activeCreatorTier.monthlyPrice * 0.8 : activeCreatorTier.monthlyPrice;
    const [whole, cents] = discounted.toFixed(2).split(".");
    return { whole, cents: `.${cents}` };
  }, [activeCreatorTier.monthlyPrice, billingCycle]);

  const creatorPeriodText = billingCycle === "yearly"
    ? (tr ? "/ ay (yıllık ödeme)" : "/ month (billed yearly)")
    : (tr ? "/ ay" : "/ month");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicNavbar showBack={false} />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/8 via-primary/5 to-transparent pointer-events-none" />
          <div className="mx-auto max-w-4xl px-4 pt-16 pb-12 text-center">
            <h1 className="text-3xl sm:text-5xl font-bold brand-gradient-text mb-4">
              {tr ? "Planınızı Seçin" : "Choose Your Plan"}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {tr ? "İhtiyacınıza uygun planı seçin ve hemen hikaye oluşturmaya başlayın." : "Pick the plan that fits your needs and start creating stories today."}
            </p>
            {user && !isUnlimited && (
              <p className="text-sm text-muted-foreground mt-3">
                {tr ? `Mevcut bakiyeniz: $${credits.toFixed(2)}` : `Current balance: $${credits.toFixed(2)}`}
              </p>
            )}
          </div>
        </section>

        {/* Three-column Plans */}
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <div className="mb-6 flex items-center justify-center">
            <div className="inline-flex rounded-xl border border-border/60 bg-card p-1">
              <button
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${billingCycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setBillingCycle("monthly")}
              >
                {tr ? "Pay Monthly" : "Pay Monthly"}
              </button>
              <button
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${billingCycle === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setBillingCycle("yearly")}
              >
                {tr ? "Pay Yearly" : "Pay Yearly"}
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3 items-start">
            {/* Free Plan */}
            <Card className="modern-shell flex flex-col h-full">
              <CardHeader className="pb-3 pt-6">
                <CardTitle className="text-xl">Free</CardTitle>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-4xl font-extrabold text-foreground">{tr ? "Ücretsiz" : "Free"}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {tr ? "Platformu ücretsiz deneyimleyin." : "Get started and experience the platform with free usage."}
                </p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-2.5 flex-1 mb-5">
                  {(tr ? [
                    "Tüm özellikleri denemek için $1 ücretsiz kullanım",
                    "Ayda 16 görsele kadar",
                    "1 kısa video (5 sn, V2 720p, sesli)",
                    "2 sesli anlatıma kadar (~300 kelime)",
                    "Filigranlı çıktılar",
                  ] : [
                    "$1 free usage to try all features",
                    "Up to 16 images per month",
                    "Up to 1 short video (5 sec, V2 720p, with audio)",
                    "Up to 2 voice narrations (~300 words each)",
                    "Watermarked outputs",
                  ]).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground/70 mb-4 italic">
                  {tr ? "Yükseltmeden önce keşfetmek isteyenler için" : "Exploring the platform before upgrading"}
                </p>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/auth")}
                >
                  {tr ? "Ücretsiz Başla" : "Get Started Free"}
                </Button>
              </CardContent>
            </Card>

            {/* Creator Plan (Tabbed) */}
            <Card className="modern-shell relative flex flex-col h-full border-primary/50 ring-2 ring-primary/20 shadow-xl">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 brand-gradient-bg text-primary-foreground text-xs px-4 py-1 border-0 shadow-md">
                {tr ? "En Popüler" : "Most Popular"}
              </Badge>
              <CardHeader className="pb-3 pt-6">
                <CardTitle className="text-xl">Creator</CardTitle>

                {/* Tabbed pricing */}
                <Tabs value={selectedCreatorTab} onValueChange={setSelectedCreatorTab} className="w-full">
                  <TabsList className="w-full grid grid-cols-4 h-9">
                {creatorTiers.map(tier => {
                      const displayPrice = billingCycle === "yearly" ? (tier.monthlyPrice * 0.8).toFixed(2) : tier.monthlyPrice.toFixed(2);
                      return (
                        <TabsTrigger key={tier.tabLabel} value={tier.tabLabel} className="text-xs font-semibold">
                          {displayPrice}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>

                <div className="flex items-baseline gap-0.5 mt-3">
                  <span className="text-4xl font-extrabold text-foreground">${creatorPrice.whole}</span>
                  <span className="text-lg text-muted-foreground font-medium">{creatorPrice.cents}</span>
                  <span className="text-sm text-muted-foreground ml-1">{creatorPeriodText}</span>
                </div>
                <div className="mt-1">
                  {billingCycle === "yearly" && (
                    <Badge variant="secondary" className="text-[11px]">
                      {tr ? "%20 indirim" : "20% discount"}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">{activeCreatorTier.description}</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-2.5 flex-1 mb-5">
                  {activeCreatorTier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground/70 mb-4 italic">{activeCreatorTier.best}</p>
                <Button
                  size="lg"
                  className="w-full brand-gradient-bg text-white border-0 hover:opacity-90 shadow-md"
                  onClick={() => navigate("/auth")}
                >
                  {tr ? "Planı Seç" : "Choose Plan"}
                </Button>
              </CardContent>
            </Card>

            {/* Agency Plan */}
            <Card className="modern-shell flex flex-col h-full">
              <CardHeader className="pb-3 pt-6">
                <CardTitle className="text-xl">Agency</CardTitle>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-3xl font-extrabold text-foreground">{tr ? "İletişime Geçin" : "Contact Sales"}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {tr ? "Ajanslar ve tam kontrol isteyen şirketler için." : "For agencies and companies that need full control and scalability."}
                </p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-2.5 flex-1 mb-5">
                  {(tr ? [
                    "White-label platform (kendi markanız)",
                    "Özel görsel kullanım limiti",
                    "Özel video kullanım limiti",
                    "Özel sesli anlatım limiti",
                    "API erişimi",
                    "Özel altyapı seçenekleri",
                    "Öncelikli destek & onboarding",
                  ] : [
                    "White-label platform (your own branding)",
                    "Custom image usage",
                    "Custom video usage",
                    "Custom voice narration usage",
                    "API access",
                    "Dedicated infrastructure options",
                    "Priority support & onboarding",
                  ]).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground/70 mb-4 italic">
                  {tr ? "Ajanslar, stüdyolar ve kurumsal kullanım" : "Agencies, studios, and enterprise use cases"}
                </p>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/contact")}
                >
                  {tr ? "Satışa Ulaşın" : "Contact Sales"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Detailed Pay-per-use pricing */}
        <section className="mx-auto max-w-6xl px-4 pb-16 space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {tr ? "Detaylı Fiyatlandırma" : "Detailed Pricing"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tr ? "Tüm planlar aşağıdaki birim fiyatları kullanır." : "All plans use the following per-unit rates."}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Image pricing */}
            <Card className="modern-shell">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{tr ? "Görsel Üretimi (Storilyne I1)" : "Image Generation (Storilyne I1)"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between rounded-xl bg-muted/50 p-4">
                  <span className="text-sm text-muted-foreground">{tr ? "Kare başına" : "Per frame"}</span>
                  <div className="flex items-baseline">
                    <span className="text-2xl font-bold text-foreground">$0</span>
                    <span className="text-lg text-foreground">.06</span>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {[
                    tr ? "Text-to-Image & Image-to-Image" : "Text-to-Image & Image-to-Image",
                    tr ? "Tüm stiller dahil" : "All styles included",
                    tr ? "Tüm formatlar" : "All formats",
                    tr ? "Yüksek çözünürlük" : "High resolution",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Video pricing - model based */}
            <Card className="modern-shell border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{tr ? "Video Üretimi" : "Video Generation"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {VIDEO_MODEL_PRICING_TABLE.map(({ model, name, resolutions }) => (
                  <div key={name} className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <p className="text-[11px] font-semibold text-foreground">{name}</p>
                      {MODEL_DESCRIPTIONS[model] && (
                        <span className="text-[10px] text-muted-foreground">— {MODEL_DESCRIPTIONS[model][language]}</span>
                      )}
                    </div>
                    {resolutions.map(({ res, perSec }) => (
                      <div key={`${name}-${res}`} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5">
                        <span className="text-[10px] text-muted-foreground">{res === "-" ? (tr ? "Tüm" : "All") : res}</span>
                        <span className="text-[10px] font-medium text-foreground">${perSec.toFixed(2)} / {tr ? "sn" : "sec"}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5">
                  {tr ? "💡 Örnek: V2, 720p, 5 sn = $1.00" : "💡 Example: V2, 720p, 5 sec = $1.00"}
                </p>
              </CardContent>
            </Card>

            {/* Voice Narration pricing */}
            <Card className="modern-shell">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{tr ? "Seslendirme" : "Voice Narration"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between rounded-xl bg-muted/50 p-4">
                  <span className="text-sm text-muted-foreground">{tr ? "1000 karakter başına" : "Per 1,000 characters"}</span>
                  <div className="flex items-baseline">
                    <span className="text-2xl font-bold text-foreground">$0</span>
                    <span className="text-lg text-foreground">.30</span>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {[
                    tr ? "Karakter bazlı fiyatlandırma" : "Character-based pricing",
                    tr ? "Çoklu dil desteği" : "Multi-language support",
                    tr ? "Profesyonel ses kütüphanesi" : "Professional voice library",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* AI Music pricing */}
            <Card className="modern-shell">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{tr ? "AI Müzik" : "AI Music"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between rounded-xl bg-muted/50 p-4">
                  <span className="text-sm text-muted-foreground">{tr ? "Saniye başına" : "Per second"}</span>
                  <div className="flex items-baseline">
                    <span className="text-2xl font-bold text-foreground">$0</span>
                    <span className="text-lg text-foreground">.002</span>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {[
                    tr ? "AI ile arka plan müziği oluşturma" : "AI background music generation",
                    tr ? "Vokal ekleme seçeneği" : "Optional vocal addition",
                    tr ? "Maks. 180 saniye (3 dakika)" : "Max 180 seconds (3 minutes)",
                    tr ? "Örn: 60 sn = $0.12" : "E.g: 60 sec = $0.12",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          {!user && (
            <div className="text-center pt-4">
              <Button size="lg" onClick={() => navigate("/auth")} className="h-12 px-10 text-base brand-gradient-bg text-primary-foreground border-0 hover:opacity-90 playful-shadow">
                {tr ? "Ücretsiz Başla" : "Get Started Free"}
              </Button>
              <p className="text-xs text-muted-foreground mt-3">{tr ? "Kredi kartı gerekmez" : "No credit card required"}</p>
            </div>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};

export default Pricing;
