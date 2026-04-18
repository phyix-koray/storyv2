import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Database, Eye, UserCheck, Lock, Mail } from "lucide-react";
import { useAppStore } from "@/lib/store";

const content = {
  tr: {
    title: "Gizlilik Politikası",
    updated: "Son güncelleme: 15 Mart 2026",
    items: [
      { icon: Database, title: "1. Veri Sorumlusu", text: "Phyix Technology (\"Şirket\"), 6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") kapsamında veri sorumlusudur." },
      { icon: Eye, title: "2. Toplanan Veriler", text: "E-posta adresi, ad-soyad (kayıt sırasında), oluşturulan hikayeler, görseller ve videolar, ödeme bilgileri (üçüncü taraf ödeme sağlayıcıları aracılığıyla), çerezler ve kullanım verileri." },
      { icon: UserCheck, title: "3. Verilerin Kullanım Amacı", text: "Hizmet sunumu, hesap yönetimi, destek, yasal yükümlülükler ve hizmet iyileştirme amaçlarıyla işlenir." },
      { icon: Lock, title: "4. Verilerin Paylaşımı", text: "Kişisel verileriniz, yasal zorunluluklar ve hizmet sağlayıcıları (bulut altyapı, ödeme işlemcileri) dışında üçüncü taraflarla paylaşılmaz." },
      { icon: Shield, title: "5. Veri Güvenliği", text: "Verileriniz şifreleme ve erişim kontrolleriyle korunur. Endüstri standardı güvenlik önlemleri uygulanır." },
      { icon: UserCheck, title: "6. Haklarınız", text: "KVKK kapsamında; verilerinize erişim, düzeltme, silme ve işlemeye itiraz haklarına sahipsiniz. Taleplerinizi destek@phyix.com adresine iletebilirsiniz." },
      { icon: Mail, title: "7. İletişim", text: "Phyix Technology — E-posta: destek@phyix.com" },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Last updated: March 15, 2026",
    items: [
      { icon: Database, title: "1. Data Controller", text: "Phyix Technology (\"Company\") is the data controller under applicable data protection regulations." },
      { icon: Eye, title: "2. Data Collected", text: "Email address, name (during registration), generated stories, images and videos, payment information (through third-party payment providers), cookies and usage data." },
      { icon: UserCheck, title: "3. Purpose of Data Use", text: "Data is processed for service delivery, account management, support, legal obligations, and service improvement purposes." },
      { icon: Lock, title: "4. Data Sharing", text: "Your personal data is not shared with third parties except for legal obligations and service providers (cloud infrastructure, payment processors)." },
      { icon: Shield, title: "5. Data Security", text: "Your data is protected with encryption and access controls. Industry-standard security measures are applied." },
      { icon: UserCheck, title: "6. Your Rights", text: "You have rights to access, rectify, delete and object to processing of your data. You can submit your requests to support@phyix.com." },
      { icon: Mail, title: "7. Contact", text: "Phyix Technology — Email: support@phyix.com" },
    ],
  },
};

export default function Privacy() {
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
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">{txt.title}</h1>
            <p className="text-sm text-muted-foreground">{txt.updated}</p>
          </div>
        </section>
        <section className="mx-auto max-w-3xl px-4 pb-16 space-y-6">
          {txt.items.map((item, i) => (
            <Card key={i} className="modern-shell">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground mb-1">{item.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
