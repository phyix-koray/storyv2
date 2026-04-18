import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import storiLyneLogo from "@/assets/storilyne-logo.png";
import { ArrowLeft } from "lucide-react";

interface PublicNavbarProps {
  showBack?: boolean;
}

const navText = {
  tr: { back: "Geri", signIn: "Giriş Yap", signUp: "Kayıt Ol" },
  en: { back: "Back", signIn: "Sign In", signUp: "Sign Up" },
};

export function PublicNavbar({ showBack = true }: PublicNavbarProps) {
  const navigate = useNavigate();
  const { language } = useAppStore();
  const txt = navText[language];

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={storiLyneLogo} alt="Storilyne" className="h-8 object-contain" />
        </Link>
        <div className="flex items-center gap-2">
          {showBack && (
            <Button variant="ghost" size="sm" onClick={() => navigate(-1 as any)} className="text-muted-foreground h-8 text-xs">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> {txt.back}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-muted-foreground">
            {txt.signIn}
          </Button>
          <Button size="sm" onClick={() => navigate("/auth")} className="gap-1.5">
            {txt.signUp}
          </Button>
        </div>
      </div>
    </nav>
  );
}
