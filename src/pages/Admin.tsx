import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Users, Image, DollarSign, Loader2, Search, Plus, TrendingDown, ShieldCheck, KeyRound, HardDrive, Trash2, Crown } from "lucide-react";
import { toast } from "sonner";

interface UserRow {
  user_id: string;
  email: string;
  credits: number;
  is_unlimited: boolean;
  created_at: string;
  project_count: number;
  total_spent: number;
  is_admin: boolean;
  storage_bytes: number;
  plan: string;
  plan_started_at: string | null;
  plan_expires_at: string | null;
}

const PLAN_OPTIONS = ["free", "starter", "creator", "growth", "agency"];

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creditAmounts, setCreditAmounts] = useState<Record<string, string>>({});
  const [togglingAdmin, setTogglingAdmin] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState({ totalUsers: 0, totalProjects: 0, totalCreditsInSystem: 0, totalSpent: 0, totalStorageBytes: 0 });
  const [unauthorized, setUnauthorized] = useState(false);
  const [planDialog, setPlanDialog] = useState<{ userId: string; current: string } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [planExpiry, setPlanExpiry] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/"); return; }
    fetchData();
  }, [user, authLoading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-users");
      if (error) throw error;

      if (data?.error === "Unauthorized") {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      const userRows: UserRow[] = (data || []).map((u: any) => ({
        user_id: u.user_id,
        email: u.email || "—",
        credits: u.credits,
        is_unlimited: u.is_unlimited,
        created_at: u.created_at,
        project_count: u.project_count,
        total_spent: u.total_spent,
        is_admin: u.is_admin || false,
        storage_bytes: u.storage_bytes || 0,
        plan: u.plan || "free",
        plan_started_at: u.plan_started_at || null,
        plan_expires_at: u.plan_expires_at || null,
      }));

      userRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setUsers(userRows);
      setStats({
        totalUsers: userRows.length,
        totalProjects: userRows.reduce((a, b) => a + b.project_count, 0),
        totalCreditsInSystem: userRows.reduce((a, b) => a + b.credits, 0),
        totalSpent: userRows.reduce((a, b) => a + b.total_spent, 0),
        totalStorageBytes: userRows.reduce((a, b) => a + b.storage_bytes, 0),
      });
    } catch (err) {
      console.error(err);
      toast.error("Veriler yüklenemedi");
    }
    setLoading(false);
  };

  const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    setTogglingAdmin(p => ({ ...p, [userId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-users", {
        body: { action: "toggle_admin", user_id: userId, grant: !currentlyAdmin },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success(currentlyAdmin ? "Admin yetkisi kaldırıldı" : "Admin yetkisi verildi");
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_admin: !currentlyAdmin } : u));
    } catch (err) {
      console.error(err);
      toast.error("İşlem başarısız");
    } finally {
      setTogglingAdmin(p => ({ ...p, [userId]: false }));
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-users", {
        body: { action: "reset_password", email },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success(`Şifre sıfırlama maili gönderildi: ${email}`);
    } catch (err) {
      console.error(err);
      toast.error("Şifre sıfırlama başarısız");
    }
  };

  const formatStorage = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const addCredits = async (userId: string) => {
    const amount = parseFloat(creditAmounts[userId] || "0");
    if (!amount || amount <= 0) { toast.error("Geçerli bir miktar girin"); return; }
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-users", {
        body: { action: "add_credits", user_id: userId, amount },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success(`$${amount.toFixed(2)} kredi eklendi`);
      setCreditAmounts(p => ({ ...p, [userId]: "" }));
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Kredi eklenemedi");
    }
  };

  const updateUserPlan = async () => {
    if (!planDialog) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-users", {
        body: {
          action: "update_plan",
          user_id: planDialog.userId,
          plan: selectedPlan,
          plan_expires_at: planExpiry || null,
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success("Plan güncellendi");
      setPlanDialog(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Plan güncellenemedi");
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-users", {
        body: { action: "delete_user", user_id: userId },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success("Kullanıcı silindi");
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Kullanıcı silinemedi");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || unauthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Sayfa bulunamadı</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => navigate(-1 as any)}>← Geri Dön</Button>
            <Button onClick={() => navigate("/")}>Ana Sayfaya Dön</Button>
          </div>
        </div>
      </div>
    );
  }

  const filtered = users.filter(u =>
    u.user_id.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const planColor = (plan: string) => {
    switch (plan) {
      case "starter": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "creator": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "growth": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      case "agency": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
          <h1 className="text-lg font-bold text-foreground">Admin Panel</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="h-8 text-xs">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Ana Sayfa
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <Card className="modern-shell">
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalUsers}</p>
                <p className="text-xs text-muted-foreground">Toplam Kullanıcı</p>
              </div>
            </CardContent>
          </Card>
          <Card className="modern-shell">
            <CardContent className="flex items-center gap-3 p-4">
              <Image className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalProjects}</p>
                <p className="text-xs text-muted-foreground">Toplam Proje</p>
              </div>
            </CardContent>
          </Card>
          <Card className="modern-shell">
            <CardContent className="flex items-center gap-3 p-4">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">${stats.totalCreditsInSystem.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Sistemdeki Kredi</p>
              </div>
            </CardContent>
          </Card>
          <Card className="modern-shell">
            <CardContent className="flex items-center gap-3 p-4">
              <TrendingDown className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-foreground">${stats.totalSpent.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Toplam Harcama</p>
              </div>
            </CardContent>
          </Card>
          <Card className="modern-shell">
            <CardContent className="flex items-center gap-3 p-4">
              <HardDrive className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{formatStorage(stats.totalStorageBytes)}</p>
                <p className="text-xs text-muted-foreground">Toplam Storage</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="modern-shell">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Kullanıcılar ({filtered.length})</CardTitle>
              <div className="relative w-72">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="E-posta veya ID ile ara..."
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                   <TableRow>
                    <TableHead className="text-xs">Admin</TableHead>
                    <TableHead className="text-xs">E-posta</TableHead>
                    <TableHead className="text-xs">Kullanıcı ID</TableHead>
                    <TableHead className="text-xs">Kayıt Tarihi</TableHead>
                    <TableHead className="text-xs">Plan</TableHead>
                    <TableHead className="text-xs">Bitiş</TableHead>
                    <TableHead className="text-xs">Bakiye</TableHead>
                    <TableHead className="text-xs">Harcanan</TableHead>
                    <TableHead className="text-xs">Storage</TableHead>
                    <TableHead className="text-xs">Projeler</TableHead>
                    <TableHead className="text-xs">Kredi Ekle</TableHead>
                    <TableHead className="text-xs">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => (
                    <TableRow key={u.user_id}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={u.is_admin}
                          disabled={togglingAdmin[u.user_id] || u.email === "koray@phyix.com"}
                          onCheckedChange={() => toggleAdmin(u.user_id, u.is_admin)}
                        />
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {u.email}
                        {u.is_unlimited && <Badge variant="secondary" className="ml-1 text-[9px]">∞</Badge>}
                        {u.is_admin && <Badge variant="default" className="ml-1 text-[9px]">Admin</Badge>}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {u.user_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("tr-TR")}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => { setPlanDialog({ userId: u.user_id, current: u.plan }); setSelectedPlan(u.plan); setPlanExpiry(u.plan_expires_at ? u.plan_expires_at.slice(0, 10) : ""); }}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase cursor-pointer hover:opacity-80 ${planColor(u.plan)}`}
                        >
                          {u.plan}
                        </button>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.plan_expires_at ? new Date(u.plan_expires_at).toLocaleDateString("tr-TR") : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-medium">${u.credits.toFixed(2)}</TableCell>
                      <TableCell className="text-xs font-medium text-destructive">
                        ${u.total_spent.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{formatStorage(u.storage_bytes)}</TableCell>
                      <TableCell className="text-xs">{u.project_count}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={creditAmounts[u.user_id] || ""}
                            onChange={e => setCreditAmounts(p => ({ ...p, [u.user_id]: e.target.value }))}
                            placeholder="$"
                            className="h-7 w-20 text-xs"
                          />
                          <Button size="sm" className="h-7 px-2 text-xs" onClick={() => addCredits(u.user_id)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => resetPassword(u.email)}
                            disabled={u.email === "—"}
                          >
                            <KeyRound className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(u.user_id)}
                            disabled={u.email === "koray@phyix.com"}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Plan Dialog */}
      <Dialog open={!!planDialog} onOpenChange={() => setPlanDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Plan Değiştir</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Plan</label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map(p => (
                    <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Bitiş Tarihi</label>
              <Input
                type="date"
                value={planExpiry}
                onChange={e => setPlanExpiry(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPlanDialog(null)}>İptal</Button>
            <Button size="sm" onClick={updateUserPlan}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Kullanıcıyı Sil</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Bu kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>İptal</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteConfirm && deleteUser(deleteConfirm)}>Sil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
