import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Users, ShoppingCart, CreditCard, AlertTriangle, Archive, Scale } from "lucide-react";
import { useAppStore } from "@/lib/store";

const content = {
  tr: {
    title: "Mesafeli Satış Sözleşmesi",
    updated: "Son güncelleme: 15 Mart 2026",
    items: [
      { icon: Users, title: "1. Taraflar", text: "SATICI: Phyix Technology — KEP: phyixtechnology@hs01.kep.tr — E-posta: destek@phyix.com\n\nALICI: Storilyne platformuna kayıt olan kullanıcı." },
      { icon: ShoppingCart, title: "2. Sözleşmenin Konusu", text: "İşbu sözleşme, Storilyne platformu üzerinden sunulan dijital içerik üretim hizmetleri (AI görsel ve video üretimi) için kredi satışına ilişkin tarafların hak ve yükümlülüklerini düzenler." },
      { icon: CreditCard, title: "3. Hizmet Detayları", text: "• Image generation: $0.06 per image\n• Video generation: Model-based pricing ($0.10–$0.50/sec)" },
      { icon: CreditCard, title: "4. Ödeme", text: "Ödemeler, iyzico altyapısı üzerinden kredi/banka kartı ile gerçekleştirilir. Satın alınan krediler anında hesaba tanımlanır." },
      { icon: AlertTriangle, title: "5. Cayma Hakkı", text: "6502 sayılı Tüketicinin Korunması Hakkında Kanun'un 15/ğ maddesi gereğince, dijital içerik hizmetlerinde cayma hakkı kullanılamaz. Satın alınan ve kullanılan krediler için iade yapılmaz." },
      { icon: Archive, title: "6. Kullanılmamış Krediler", text: "Kullanılmamış krediler hesapta süresiz olarak saklanır ve iade edilmez." },
      { icon: Scale, title: "7. Uyuşmazlık", text: "Bu sözleşmeden doğan uyuşmazlıklarda Türkiye Cumhuriyeti mahkemeleri ve icra daireleri yetkilidir." },
    ],
  },
  en: {
    title: "Terms of Service",
    updated: "Last updated: March 15, 2026",
    items: [
      { icon: Users, title: "1. Parties", text: "SELLER: Phyix Technology — Email: support@phyix.com\n\nBUYER: User registered on the Storilyne platform." },
      { icon: ShoppingCart, title: "2. Subject of Agreement", text: "This agreement regulates the rights and obligations of the parties regarding credit sales for digital content production services (AI image and video generation) offered through the Storilyne platform." },
      { icon: CreditCard, title: "3. Service Details", text: "• Image generation: $0.06 per image\n• Video generation: Model-based pricing ($0.10–$0.50/sec)" },
      { icon: CreditCard, title: "4. Payment", text: "Payments are processed via credit/debit card through the iyzico payment infrastructure. Purchased credits are instantly credited to your account." },
      { icon: AlertTriangle, title: "5. Right of Withdrawal", text: "In accordance with applicable consumer protection laws, the right of withdrawal cannot be exercised for digital content services. Purchased and used credits are non-refundable." },
      { icon: Archive, title: "6. Unused Credits", text: "Unused credits are stored indefinitely in the account and are non-refundable." },
      { icon: Scale, title: "7. Disputes", text: "Disputes arising from this agreement are subject to the jurisdiction of the courts and enforcement offices of the Republic of Turkey." },
    ],
  },
};

export default function Terms() {
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
              <FileText className="h-7 w-7 text-primary" />
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
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{item.text}</p>
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
