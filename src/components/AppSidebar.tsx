import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { NavLink } from "@/components/NavLink";
import {
  BookOpen, Users, PlusCircle, Package, FileText,
  LogIn, LogOut, Wallet, Settings, ChevronRight,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { Separator } from "@/components/ui/separator";
import storiLyneLogo from "@/assets/storilyne-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { language, resetStory } = useAppStore();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signOut } = useAuth();
  const { credits, isUnlimited, loading: creditsLoading } = useCredits();

  const handleNewStory = () => {
    resetStory();
    navigate("/");
  };

  const userInitial = user?.email?.[0]?.toUpperCase() || "?";

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      {/* Brand Header with Logo */}
      <SidebarHeader className="px-3 py-4">
        <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
          {collapsed ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl overflow-hidden">
              <img src={storiLyneLogo} alt="Storilyne" className="h-7 w-7 object-contain" />
            </div>
          ) : (
            <img src={storiLyneLogo} alt="Storilyne" className="h-8 object-contain" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Create */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild={false}
                  onClick={handleNewStory}
                  tooltip={t(language, "newStory")}
                  className="bg-primary/10 text-primary hover:bg-primary/20 font-semibold border border-primary/15"
                >
                  <PlusCircle className="h-4 w-4" />
                  {!collapsed && <span>{t(language, "newStory")}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {!collapsed && (language === "tr" ? "İçerik" : "Content")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {[
                { to: "/history", icon: BookOpen, label: t(language, "history") },
                { to: "/characters", icon: Users, label: t(language, "characters") },
                { to: "/objects", icon: Package, label: t(language, "objects") },
                { to: "/templates", icon: FileText, label: language === "tr" ? "Şablonlar" : "Templates" },
              ].map(({ to, icon: Icon, label }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton asChild tooltip={label}>
                    <NavLink
                      to={to}
                      className="hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary"
                    >
                      <Icon className="h-4 w-4" />
                      {!collapsed && <span>{label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        {/* Wallet Card */}
        {user && !creditsLoading && !collapsed && (
          <button
            onClick={() => navigate("/settings")}
            className="group mb-2 flex items-center justify-between rounded-xl border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5 transition-all hover:bg-sidebar-accent hover:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <div className="text-left">
                <p className="text-[10px] text-muted-foreground leading-none mb-0.5">
                  {language === "tr" ? "Bakiye" : "Balance"}
                </p>
                <p className="text-sm font-semibold text-sidebar-foreground">
                  {isUnlimited ? "∞" : `$${Number(credits).toFixed(2)}`}
                </p>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}

        {user && !creditsLoading && collapsed && (
          <button
            onClick={() => navigate("/settings")}
            className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent/50 transition-colors hover:bg-sidebar-accent mx-auto"
            title={isUnlimited ? "∞" : `$${Number(credits).toFixed(2)}`}
          >
            <Wallet className="h-3.5 w-3.5 text-primary" />
          </button>
        )}

        {/* Settings */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={language === "tr" ? "Ayarlar" : "Settings"}>
              <NavLink
                to="/settings"
                className="hover:bg-sidebar-accent transition-colors"
                activeClassName="bg-primary/10 text-primary font-medium border-l-2 border-primary"
              >
                <Settings className="h-4 w-4" />
                {!collapsed && <span>{language === "tr" ? "Ayarlar" : "Settings"}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <Separator className="my-1" />

        {/* User section */}
        {!loading && (
          <div className="px-1">
            {user ? (
              <button
                onClick={signOut}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-sidebar-accent ${collapsed ? "justify-center px-0" : ""}`}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {userInitial}
                </div>
                {!collapsed && (
                  <div className="flex flex-1 items-center justify-between min-w-0">
                    <div className="text-left min-w-0">
                      <p className="text-xs font-medium text-sidebar-foreground truncate">{user.email}</p>
                      <p className="text-[10px] text-muted-foreground">{language === "tr" ? "Çıkış Yap" : "Sign Out"}</p>
                    </div>
                    <LogOut className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
                  </div>
                )}
              </button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/auth")}
                className={`w-full text-xs ${collapsed ? "w-8 h-8 p-0" : "h-9 justify-start gap-2"}`}
              >
                <LogIn className="h-3.5 w-3.5" />
                {!collapsed && (language === "tr" ? "Giriş Yap" : "Sign In")}
              </Button>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}