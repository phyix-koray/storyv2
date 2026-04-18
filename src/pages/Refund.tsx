import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw, AlertTriangle, Wrench, Mail } from "lucide-react";
import { useAppStore } from "@/lib/store";

const content = {
  tr: {
    title: "İade Şartları",
    updated: "Son güncelleme: 15 Mart 2026",
    digital: { title: "Dijital İçerik Hizmetleri", text: "Storilyne platformunda sunulan hizmetler dijital içerik niteliğindedir. 6502 sayılı Kanun'un 15/ğ maddesi uyarınca, dijital içerik hizmetlerinde cayma hakkı bulunmamaktadır." },
    technical: { title: "Teknik Sorunlar", text: "Teknik bir sorun nedeniyle kredi harcandığı halde hizmet alınamadığı durumlarda, destek ekibimize başvurarak kredi iadenizi talep edebilirsiniz. Talepler 7 iş günü içinde değerlendirilir." },
    contact: { title: "İletişim", text: "İade talepleriniz için:" },
  },
  en: {
    title: "Refund Policy",
    updated: "Last updated: March 15, 2026",
    digital: { title: "Digital Content Services", text: "Services offered on the Storilyne platform are digital content. In accordance with applicable consumer protection laws, the right of withdrawal does not apply to digital content services." },
    technical: { title: "Technical Issues", text: "If credits were charged but the service was not delivered due to a technical issue, you can request a credit refund by contacting our support team. Requests are reviewed within 7 business days." },
    contact: { title: "Contact", text: "For refund requests:" },
  },
};

export default function Refund() {
  const { language } = useAppStore();
  const txt = content[language];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicNavbar />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="mx-auto max-w-4xl px-4 pt-16 pb-8 text-center">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <RotateCcw className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">{txt.title}</h1>
            <p className="text-sm text-muted-foreground">{txt.updated}</p>
          </div>
        </section>
        <section className="mx-auto max-w-3xl px-4 pb-16 space-y-6">
          <Card className="modern-shell">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground mb-1">{txt.digital.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{txt.digital.text}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="modern-shell">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 mt-0.5">
                  <Wrench className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground mb-1">{txt.technical.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{txt.technical.text}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="modern-shell border-primary/20 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground mb-1">{txt.contact.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {txt.contact.text} <strong>support@phyix.com</strong>
                  </p>
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
