import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, ExternalLink, Coins, ArrowDownCircle, ArrowUpCircle,
  Wallet, CreditCard, Loader2, Plus, TrendingUp, TrendingDown,
  DollarSign, Link2, ShieldCheck, FileText, Globe, AlertTriangle,
  Receipt, Eye, Bug, MessageSquare, Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

export default function Settings() {
  const { language } = useAppStore();
  const { user } = useAuth();
  const { credits, isUnlimited, refetch } = useCredits();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState("10");
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [selectedQuickAmount, setSelectedQuickAmount] = useState<string | "custom">("10");
  const [defaultPublic, setDefaultPublic] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"feedback" | "bug">("feedback");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchTransactions = async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setTransactions((data as any) || []);
      setTxLoading(false);
    };
    fetchTransactions();
  }, [user]);

  const handleTopUp = async () => {
    if (!user) {
      toast.error(language === "tr" ? "Lütfen giriş yapın" : "Please sign in");
      return;
    }
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount < 5) {
      toast.error(language === "tr" ? "Minimum yükleme $5.00" : "Minimum top-up is $5.00");
      return;
    }
    setTopUpLoading(true);
    const { error: updateError } = await supabase
      .from("user_credits")
      .update({ credits: credits + amount })
      .eq("user_id", user.id);
    if (updateError) {
      toast.error(language === "tr" ? "Bir hata oluştu" : "An error occurred");
      setTopUpLoading(false);
      return;
    }
    await supabase.from("credit_transactions").insert({
      user_id: user.id,
      amount,
      type: "topup",
      description: language === "tr" ? `Cüzdan yükleme: $${amount.toFixed(2)}` : `Wallet top-up: $${amount.toFixed(2)}`,
    });
    await refetch();
    const { data } = await supabase
      .from("credit_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setTransactions((data as any) || []);
    setTopUpLoading(false);
    toast.success(language === "tr" ? `$${amount.toFixed(2)} cüzdanınıza eklendi!` : `$${amount.toFixed(2)} added to your wallet!`);
    setTopUpAmount("10");
    setSelectedQuickAmount("10");
  };

  const integrations = [
    { name: "Instagram", icon: "📷", status: "coming_soon" },
    { name: "TikTok", icon: "🎵", status: "coming_soon" },
    { name: "YouTube", icon: "▶️", status: "coming_soon" },
    { name: "Facebook", icon: "📘", status: "coming_soon" },
    { name: "X (Twitter)", icon: "✖️", status: "coming_soon" },
  ];

  const quickAmounts = [
    { value: "10", label: "$10", desc: language === "tr" ? "Yaklaşık 14 adet 720p/5sn video" : "Approx. 14x 720p/5s videos" },
    { value: "20", label: "$20", desc: language === "tr" ? "Yaklaşık 28 adet 720p/5sn video" : "Approx. 28x 720p/5s videos" },
    { value: "50", label: "$50", desc: language === "tr" ? "Yaklaşık 71 adet 720p/5sn video" : "Approx. 71x 720p/5s videos" },
  ];

  const totalSpent = transactions.filter(t => t.type === "debit").reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalAdded = transactions.filter(t => t.type !== "debit").reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const dailyAvg = transactions.length > 0
    ? totalSpent / Math.max(1, Math.ceil((Date.now() - new Date(transactions[transactions.length - 1].created_at).getTime()) / 86400000))
    : 0;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 items-center gap-3 border-b border-border px-6">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <h1 className="text-lg font-semibold">{language === "tr" ? "Ayarlar" : "Settings"}</h1>
          </header>

          <main className="flex-1 p-6">
            <div className="max-w-5xl mx-auto space-y-6">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground -ml-2">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                {language === "tr" ? "Ana Sayfa" : "Home"}
              </Button>

              <Tabs defaultValue="credits" className="w-full">
                <TabsList className="h-11 bg-muted/50 p-1 gap-1">
                  <TabsTrigger value="credits" className="gap-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Coins className="h-4 w-4" />
                    {language === "tr" ? "Krediler" : "Credits"}
                  </TabsTrigger>
                  <TabsTrigger value="billing" className="gap-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <CreditCard className="h-4 w-4" />
                    {language === "tr" ? "Fatura" : "Billing"}
                  </TabsTrigger>
                  <TabsTrigger value="invoices" className="gap-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Receipt className="h-4 w-4" />
                    {language === "tr" ? "Faturalar" : "Invoices"}
                  </TabsTrigger>
                  <TabsTrigger value="integrations" className="gap-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Link2 className="h-4 w-4" />
                    {language === "tr" ? "Entegrasyonlar" : "Integrations"}
                  </TabsTrigger>
                  <TabsTrigger value="general" className="gap-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Globe className="h-4 w-4" />
                    {language === "tr" ? "Genel" : "General"}
                  </TabsTrigger>
                  <TabsTrigger value="feedback" className="gap-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <MessageSquare className="h-4 w-4" />
                    {language === "tr" ? "Geri Bildirim" : "Feedback"}
                  </TabsTrigger>
                </TabsList>

                {/* ===== CREDITS TAB ===== */}
                <TabsContent value="credits" className="space-y-5 mt-5">
                  {/* Balance Overview - 3 cards like reference */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border border-border">
                      <CardContent className="p-5">
                        <p className="text-xs text-muted-foreground mb-1">
                          {language === "tr" ? "Mevcut bakiye" : "Current balance"}
                        </p>
                        <p className="text-3xl font-bold text-primary">
                          {user ? (isUnlimited ? "∞" : `$${Number(credits).toFixed(2)}`) : "—"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          {language === "tr" ? "Bakiye güncellemeleri anlık olarak yansır" : "Balance updates may take a moment to reflect"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border border-border">
                      <CardContent className="p-5">
                        <p className="text-xs text-muted-foreground mb-1">
                          {language === "tr" ? "Bu ay kullanılan" : "Usage this month"}
                        </p>
                        <p className="text-3xl font-bold text-foreground">${totalSpent.toFixed(2)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            ${dailyAvg.toFixed(2)}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {language === "tr" ? "Günlük ortalama" : "Daily average"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-border">
                      <CardContent className="p-5">
                        <p className="text-xs text-muted-foreground mb-1">
                          {language === "tr" ? "Toplam yüklenen" : "Total added"}
                        </p>
                        <p className="text-3xl font-bold text-foreground">${totalAdded.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Add Credits + Auto Top-up side by side */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Add Credits */}
                    <Card className="border border-border">
                      <CardContent className="p-5">
                        <h3 className="text-sm font-semibold mb-4">{language === "tr" ? "Kredi Ekle" : "Add Credits"}</h3>
                        <div className="space-y-1">
                          {quickAmounts.map((amt) => (
                            <label
                              key={amt.value}
                              className={`flex items-center gap-3 rounded-lg px-3 py-3 cursor-pointer transition-colors border ${
                                selectedQuickAmount === amt.value
                                  ? "border-primary bg-primary/5"
                                  : "border-transparent hover:bg-muted/50"
                              }`}
                            >
                              <input
                                type="radio"
                                name="topup"
                                checked={selectedQuickAmount === amt.value}
                                onChange={() => { setSelectedQuickAmount(amt.value); setTopUpAmount(amt.value); }}
                                className="accent-primary"
                              />
                              <span className="text-sm font-semibold w-12">{amt.label}</span>
                              <span className="text-xs text-muted-foreground">{amt.desc}</span>
                            </label>
                          ))}
                          <label
                            className={`flex items-center gap-3 rounded-lg px-3 py-3 cursor-pointer transition-colors border ${
                              selectedQuickAmount === "custom"
                                ? "border-primary bg-primary/5"
                                : "border-transparent hover:bg-muted/50"
                            }`}
                          >
                            <input
                              type="radio"
                              name="topup"
                              checked={selectedQuickAmount === "custom"}
                              onChange={() => setSelectedQuickAmount("custom")}
                              className="accent-primary"
                            />
                            <span className="text-sm font-semibold">{language === "tr" ? "Özel" : "Custom"}</span>
                            <span className="text-xs text-muted-foreground">{language === "tr" ? "İstediğiniz tutarı girin" : "Buy any amount of credits"}</span>
                          </label>
                        </div>

                        <div className="flex items-center gap-2 mt-4">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                            <Input
                              type="number"
                              value={topUpAmount}
                              onChange={(e) => { setTopUpAmount(e.target.value); setSelectedQuickAmount("custom"); }}
                              min={5}
                              step={1}
                              className="pl-7 h-10"
                            />
                          </div>
                          <Button onClick={handleTopUp} disabled={topUpLoading} className="h-10 px-6">
                            {topUpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (language === "tr" ? "Satın Al" : "Buy")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Auto Top-up */}
                    <Card className="border border-border">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-sm font-semibold">{language === "tr" ? "Otomatik Yükleme" : "Auto Top-up"}</h3>
                          <Badge variant="secondary" className="text-[10px]">
                            {language === "tr" ? "Pasif" : "Inactive"}
                          </Badge>
                        </div>

                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <AlertTriangle className="h-5 w-5 text-amber-500 mb-3" />
                          <p className="text-xs text-muted-foreground max-w-[250px]">
                            {language === "tr"
                              ? "Otomatik yükleme için önce bir ödeme yöntemi eklemeniz gerekiyor."
                              : "You need to add a payment method before setting up automated top-ups."}
                          </p>
                          <Button variant="outline" size="sm" className="mt-4" disabled>
                            {language === "tr" ? "Ödeme Yöntemi Ekle" : "Add Payment Method"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Credit Activity Table */}
                  <Card className="border border-border">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold mb-4">{language === "tr" ? "Kredi Hareketleri" : "Credit Activity"}</h3>

                      {!user ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          {language === "tr" ? "Lütfen giriş yapın" : "Please sign in"}
                        </div>
                      ) : txLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : transactions.length === 0 ? (
                        <div className="py-8 text-center">
                          <Coins className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                          <p className="text-sm text-muted-foreground">{language === "tr" ? "Henüz işlem yok" : "No transactions yet"}</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">
                                  {language === "tr" ? "Tarih" : "Effective Date"}
                                </th>
                                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">
                                  {language === "tr" ? "Açıklama" : "Description"}
                                </th>
                                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">
                                  {language === "tr" ? "Tutar" : "Amount"}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {transactions.map((tx) => (
                                <tr key={tx.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                                  <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                                    {new Date(tx.created_at).toLocaleDateString(language === "tr" ? "tr-TR" : "en-US", {
                                      day: "numeric", month: "short", year: "numeric"
                                    })}
                                  </td>
                                  <td className="py-3 px-3 text-sm text-foreground">
                                    {tx.description || tx.type}
                                  </td>
                                  <td className={`py-3 px-3 text-sm font-semibold text-right tabular-nums ${tx.type === "debit" ? "text-destructive" : "text-green-600"}`}>
                                    {tx.type === "debit" ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ===== BILLING TAB ===== */}
                <TabsContent value="billing" className="space-y-5 mt-5">
                  {/* Payment Methods */}
                  <Card className="border border-border">
                    <CardContent className="p-5">
                      <div className="mb-1">
                        <h3 className="text-sm font-semibold">{language === "tr" ? "Ödeme Yöntemleri" : "Payment Methods"}</h3>
                        <p className="text-xs text-muted-foreground">
                          {language === "tr"
                            ? "Kartlarınızı yönetin, varsayılan belirleyin veya yeni ödeme yöntemi ekleyin."
                            : "Manage your saved cards, set a default, or add new payment methods for purchases."}
                        </p>
                      </div>

                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted mb-3">
                          <CreditCard className="h-7 w-7 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">
                          {language === "tr" ? "Henüz ödeme yöntemi eklenmedi" : "No payment methods added yet"}
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                          {language === "tr"
                            ? "Kredi satın almak ve fatura almak için bir kart ekleyin."
                            : "Add a card to purchase credits and receive invoices."}
                        </p>
                        <p className="text-[11px] text-muted-foreground mb-4 italic">
                          {language === "tr"
                            ? "Otomatik yükleme için gerekli"
                            : "Required for Auto Top-up"}
                        </p>
                        <Button variant="outline" size="sm" disabled>
                          {language === "tr" ? "Kart Ekle" : "Add Card"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Billing Address */}
                  <Card className="border border-border">
                    <CardContent className="p-5">
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold">{language === "tr" ? "Fatura Adresi" : "Billing Address"}</h3>
                        <p className="text-xs text-muted-foreground">
                          {language === "tr"
                            ? "Faturalar ve vergi amaçlı kullanılır. Bilgilerin doğru olduğundan emin olun."
                            : "Used for invoices and tax purposes. Please ensure this information is accurate."}
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">{language === "tr" ? "Ad Soyad" : "Full Name"}</Label>
                            <Input placeholder={language === "tr" ? "Ad Soyad" : "Full Name"} className="mt-1" disabled />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">{language === "tr" ? "Adres" : "Address"}</Label>
                            <Input placeholder={language === "tr" ? "Adres satırı" : "Address line"} className="mt-1" disabled />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">{language === "tr" ? "Şehir" : "City"}</Label>
                              <Input placeholder={language === "tr" ? "Şehir" : "City"} className="mt-1" disabled />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">{language === "tr" ? "Posta Kodu" : "Zip Code"}</Label>
                              <Input placeholder="00000" className="mt-1" disabled />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">{language === "tr" ? "Eyalet/İl" : "State"}</Label>
                              <Input placeholder={language === "tr" ? "İl" : "State"} className="mt-1" disabled />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">{language === "tr" ? "Ülke" : "Country"}</Label>
                              <Input placeholder={language === "tr" ? "Ülke" : "Country"} className="mt-1" disabled />
                            </div>
                          </div>
                        </div>

                        <Card className="border border-border bg-muted/30">
                          <CardContent className="p-4">
                            <h4 className="text-sm font-semibold mb-1">{language === "tr" ? "Vergi Tahmini" : "Tax Estimate"}</h4>
                            <p className="text-[11px] text-muted-foreground mb-3">
                              {language === "tr" ? "Fatura adresinize göre tahmini vergi." : "Estimated tax based on your billing address."}
                            </p>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{language === "tr" ? "Alt toplam" : "Subtotal"}</span>
                                <span className="text-foreground">—</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{language === "tr" ? "Vergi" : "Tax"}</span>
                                <span className="text-foreground">—</span>
                              </div>
                              <Separator />
                              <div className="flex justify-between font-semibold">
                                <span>{language === "tr" ? "Toplam" : "Total"}</span>
                                <span>—</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <Button size="sm" className="mt-4" disabled>
                        {language === "tr" ? "Kaydet" : "Save"}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ===== INVOICES TAB ===== */}
                <TabsContent value="invoices" className="space-y-5 mt-5">
                  <Card className="border border-border">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-sm font-semibold">{language === "tr" ? "Faturalar" : "Invoices"}</h3>
                          <p className="text-xs text-muted-foreground">
                            {language === "tr" ? "Geçmiş faturalarınızı görüntüleyin ve indirin." : "View and download your past invoices."}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted mb-3">
                          <FileText className="h-7 w-7 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">
                          {language === "tr" ? "Henüz fatura yok" : "No invoices yet"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === "tr"
                            ? "Bir satın alma işlemi yaptığınızda faturalarınız burada görünecektir."
                            : "Your invoices will appear here once you make a purchase."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ===== INTEGRATIONS TAB ===== */}
                <TabsContent value="integrations" className="space-y-4 mt-5">
                  <Card className="border border-border">
                    <CardContent className="p-5">
                      <div className="mb-5">
                        <h3 className="text-sm font-semibold">{language === "tr" ? "Platform Bağlantıları" : "Platform Connections"}</h3>
                        <p className="text-xs text-muted-foreground">
                          {language === "tr" ? "Sosyal medya hesaplarınızı bağlayın" : "Connect your social media accounts"}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {integrations.map((p) => (
                          <button
                            key={p.name}
                            onClick={() => toast.info(language === "tr" ? `${p.name} entegrasyonu yakında!` : `${p.name} integration coming soon!`)}
                            className="flex w-full items-center gap-3 rounded-lg border border-border/60 px-4 py-3 transition-all hover:border-primary/30 hover:bg-muted/40"
                          >
                            <span className="text-xl">{p.icon}</span>
                            <span className="flex-1 text-left text-sm font-medium text-foreground">{p.name}</span>
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              {language === "tr" ? "Yakında" : "Coming Soon"}
                            </Badge>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50" />
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ===== GENERAL TAB ===== */}
                <TabsContent value="general" className="space-y-5 mt-5">
                  <Card className="border border-border">
                    <CardContent className="p-5">
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold">{language === "tr" ? "Arayüz Dili" : "Interface Language"}</h3>
                        <p className="text-xs text-muted-foreground">
                          {language === "tr" ? "Uygulamanın görüntülenme dilini seçin" : "Choose the display language of the application"}
                        </p>
                      </div>
                      <div className="max-w-xs">
                        <LanguageSelector />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Privacy / Visibility */}
                  <Card className="border border-border">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <h3 className="text-sm font-semibold">
                              {language === "tr" ? "Hikaye Görünürlüğü" : "Story Visibility"}
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground max-w-md">
                            {language === "tr"
                              ? "Açıldığında yeni oluşturduğunuz hikayeler topluluk galerisinde görünür olur. Kapatıldığında hikayeleriniz gizli kalır."
                              : "When enabled, your new stories will be visible in the community gallery. When disabled, your stories remain private."}
                          </p>
                        </div>
                        <Switch
                          checked={defaultPublic}
                          onCheckedChange={async (checked) => {
                            setDefaultPublic(checked);
                            toast.success(
                              language === "tr"
                                ? checked ? "Yeni hikayeler herkese açık olacak" : "Yeni hikayeler gizli olacak"
                                : checked ? "New stories will be public" : "New stories will be private"
                            );
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                </TabsContent>

                {/* ===== FEEDBACK TAB ===== */}
                <TabsContent value="feedback" className="space-y-5 mt-5">
                  <Card className="border border-border">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold mb-1">
                        {language === "tr" ? "Geri Bildirim & Hata Bildir" : "Feedback & Bug Report"}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        {language === "tr"
                          ? "Önerilerinizi paylaşın veya karşılaştığınız hataları bildirin."
                          : "Share your suggestions or report bugs you've encountered."}
                      </p>

                      <div className="flex gap-2 mb-4">
                        <Button
                          variant={feedbackType === "feedback" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFeedbackType("feedback")}
                          className="gap-1.5"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {language === "tr" ? "Geri Bildirim" : "Feedback"}
                        </Button>
                        <Button
                          variant={feedbackType === "bug" ? "destructive" : "outline"}
                          size="sm"
                          onClick={() => setFeedbackType("bug")}
                          className="gap-1.5"
                        >
                          <Bug className="h-3.5 w-3.5" />
                          {language === "tr" ? "Hata Bildir" : "Report Bug"}
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <Textarea
                          value={feedbackMsg}
                          onChange={(e) => setFeedbackMsg(e.target.value)}
                          placeholder={feedbackType === "bug"
                            ? (language === "tr" ? "Karşılaştığınız hatayı detaylı açıklayın..." : "Describe the bug in detail...")
                            : (language === "tr" ? "Önerinizi veya düşüncenizi yazın..." : "Share your feedback or suggestion...")}
                          rows={5}
                        />
                        <Button
                          onClick={async () => {
                            if (!feedbackMsg.trim()) {
                              toast.error(language === "tr" ? "Lütfen bir mesaj yazın" : "Please write a message");
                              return;
                            }
                            setFeedbackSending(true);
                            // TODO: send via edge function to email
                            await new Promise(r => setTimeout(r, 1000));
                            toast.success(language === "tr" ? "Mesajınız gönderildi. Teşekkürler!" : "Message sent. Thank you!");
                            setFeedbackMsg("");
                            setFeedbackSending(false);
                          }}
                          disabled={feedbackSending}
                          className="gap-1.5"
                        >
                          {feedbackSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          {language === "tr" ? "Gönder" : "Send"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
