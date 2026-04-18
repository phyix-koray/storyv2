import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Building2, Send, Phone } from "lucide-react";
import { toast } from "sonner";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";
import { useAppStore } from "@/lib/store";

const content = {
  tr: {
    title: "İletişim",
    desc: "Sorularınız veya önerileriniz mi var? Bize ulaşın.",
    phone: "Telefon",
    email: "E-posta",
    kep: "KEP Adresi",
    taxOffice: "Vergi Dairesi",
    taxNo: "Vergi No",
    tradeReg: "Ticaret Sicil No",
    mersisNo: "Mersis No",
    responsible: "Sorumlu Kişi",
    notUpdated: "Henüz güncellenmedi",
    legalNote: "📧 Yasal bildirimler ve arabuluculuk başvurularını",
    kepVia: "KEP adresi üzerinden Koray Bakırküre'ye iletebilirsiniz.",
    formTitle: "Bize Yazın",
    nameLabel: "Ad Soyad",
    namePlaceholder: "Adınız...",
    emailLabel: "E-posta",
    emailPlaceholder: "ornek@email.com",
    messageLabel: "Mesajınız",
    messagePlaceholder: "Mesajınızı yazın...",
    send: "Gönder",
    sending: "Gönderiliyor...",
    fillAll: "Lütfen tüm alanları doldurun.",
    success: "Mesajınız gönderildi. En kısa sürede dönüş yapacağız.",
  },
  en: {
    title: "Contact",
    desc: "Have questions or suggestions? Get in touch with us.",
    phone: "Phone",
    email: "Email",
    kep: "KEP Address",
    taxOffice: "Tax Office",
    taxNo: "Tax Number",
    tradeReg: "Trade Registry No",
    mersisNo: "Mersis No",
    responsible: "Responsible Person",
    notUpdated: "Not yet updated",
    legalNote: "📧 Legal notices and mediation applications can be sent to Koray Bakırküre via",
    kepVia: "KEP address.",
    formTitle: "Write to Us",
    nameLabel: "Full Name",
    namePlaceholder: "Your name...",
    emailLabel: "Email",
    emailPlaceholder: "example@email.com",
    messageLabel: "Your Message",
    messagePlaceholder: "Write your message...",
    send: "Send",
    sending: "Sending...",
    fillAll: "Please fill in all fields.",
    success: "Your message has been sent. We'll get back to you soon.",
  },
};

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { language } = useAppStore();
  const txt = content[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error(txt.fillAll);
      return;
    }
    setSending(true);
    await new Promise(r => setTimeout(r, 1000));
    toast.success(txt.success);
    setName(""); setEmail(""); setMessage("");
    setSending(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicNavbar />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="mx-auto max-w-4xl px-4 pt-16 pb-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">{txt.title}</h1>
            <p className="text-muted-foreground">{txt.desc}</p>
          </div>
        </section>
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <Card className="modern-shell">
                <CardContent className="p-5 space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Phyix Technology</p>
                      <p className="text-sm text-muted-foreground">Kazım Özalp Sok. Cumhuriyet Apt. 38/8 Şaşkınbakkal, Kadıköy, İstanbul</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">hello@phyix.com</p>
                      <p className="text-sm text-muted-foreground">{txt.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">+90 537 272 01 37</p>
                      <p className="text-sm text-muted-foreground">{txt.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">koray.bakirkure@hs01.kep.tr</p>
                      <p className="text-sm text-muted-foreground">{txt.kep}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="modern-shell">
                <CardContent className="p-5 space-y-3 text-sm text-muted-foreground">
                  <p><span className="font-semibold text-foreground">{txt.taxOffice}:</span> Erenköy Vergi Dairesi</p>
                  <p><span className="font-semibold text-foreground">{txt.taxNo}:</span> 1321 0290 41</p>
                  <p><span className="font-semibold text-foreground">{txt.tradeReg}:</span> {txt.notUpdated}</p>
                  <p><span className="font-semibold text-foreground">{txt.mersisNo}:</span> {txt.notUpdated}</p>
                  <p><span className="font-semibold text-foreground">{txt.responsible}:</span> Koray Bakırküre</p>
                </CardContent>
              </Card>
              <Card className="modern-shell border-primary/20 bg-primary/5">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {txt.legalNote} <span className="font-semibold text-foreground">koray.bakirkure@hs01.kep.tr</span> {txt.kepVia}
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card className="modern-shell">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">{txt.formTitle}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm">{txt.nameLabel}</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder={txt.namePlaceholder} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm">{txt.emailLabel}</Label>
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={txt.emailPlaceholder} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="message" className="text-sm">{txt.messageLabel}</Label>
                    <Textarea id="message" value={message} onChange={e => setMessage(e.target.value)} placeholder={txt.messagePlaceholder} rows={5} />
                  </div>
                  <Button type="submit" disabled={sending} className="w-full">
                    <Send className="mr-2 h-4 w-4" />
                    {sending ? txt.sending : txt.send}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
