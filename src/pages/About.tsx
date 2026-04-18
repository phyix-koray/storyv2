import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Mail, Sparkles, Target, Users } from "lucide-react";
import storiLyneLogo from "@/assets/storilyne-logo.png";
import { useAppStore } from "@/lib/store";

const content = {
  tr: {
    title: "Hakkımızda",
    desc: "Storilyne, yapay zeka destekli görsel hikaye ve video üretim platformudur. Herkesin yaratıcılığını dijital hikayelere dönüştürmesini kolaylaştırıyoruz.",
    mission: { title: "Misyonumuz", text: "Herkesin yaratıcı fikirlerini profesyonel görsel hikayelere ve videolara dönüştürmesini kolaylaştırmak." },
    vision: { title: "Vizyonumuz", text: "Yapay zeka ile içerik üretimini demokratikleştirerek, herkesi bir hikaye anlatıcısına dönüştürmek." },
    community: { title: "Topluluk", text: "Binlerce içerik üreticisi Storilyne ile hikayelerini hayata geçiriyor." },
    companyInfo: "Şirket Bilgileri",
    companyName: "Ticari Unvan",
    email: "E-posta",
    kep: "KEP Adresi",
  },
  en: {
    title: "About Us",
    desc: "Storilyne is an AI-powered visual story and video creation platform. We make it easy for everyone to turn their creativity into digital stories.",
    mission: { title: "Our Mission", text: "To make it easy for everyone to turn their creative ideas into professional visual stories and videos." },
    vision: { title: "Our Vision", text: "To democratize content creation with AI, turning everyone into a storyteller." },
    community: { title: "Community", text: "Thousands of content creators bring their stories to life with Storilyne." },
    companyInfo: "Company Information",
    companyName: "Company Name",
    email: "Email",
    kep: "KEP Address",
  },
};

export default function About() {
  const { language } = useAppStore();
  const txt = content[language];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicNavbar />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="mx-auto max-w-4xl px-4 pt-16 pb-12 text-center">
            <img src={storiLyneLogo} alt="Storilyne" className="h-12 mx-auto mb-6" />
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{txt.title}</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">{txt.desc}</p>
          </div>
        </section>
        <section className="mx-auto max-w-5xl px-4 pb-16 space-y-8">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="modern-shell text-center">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-primary/10 mb-4">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{txt.mission.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{txt.mission.text}</p>
              </CardContent>
            </Card>
            <Card className="modern-shell text-center">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-accent/10 mb-4">
                  <Sparkles className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{txt.vision.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{txt.vision.text}</p>
              </CardContent>
            </Card>
            <Card className="modern-shell text-center">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-primary/10 mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{txt.community.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{txt.community.text}</p>
              </CardContent>
            </Card>
          </div>
          <Card className="modern-shell">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">{txt.companyInfo}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Phyix Technology</p>
                    <p className="text-xs text-muted-foreground">{txt.companyName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">destek@phyix.com</p>
                    <p className="text-xs text-muted-foreground">{txt.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">phyixtechnology@hs01.kep.tr</p>
                    <p className="text-xs text-muted-foreground">{txt.kep}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
