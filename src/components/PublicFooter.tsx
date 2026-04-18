import { Link } from "react-router-dom";
import { useAppStore } from "@/lib/store";
import storiLyneLogo from "@/assets/storilyne-logo.png";

const footerText = {
  tr: {
    desc: "AI destekli görsel hikaye ve video üretim platformu.",
    product: "Ürün",
    pricing: "Fiyatlandırma",
    features: "Özellikler",
    signUp: "Kayıt Ol",
    legal: "Yasal",
    privacy: "Gizlilik Politikası",
    terms: "Mesafeli Satış Sözleşmesi",
    refund: "İade Şartları",
    company: "Şirket",
    about: "Hakkımızda",
    contact: "İletişim",
    copyright: "© 2026 Phyix Technology. Tüm hakları saklıdır.",
    paymentAlt: "Ödeme yöntemleri",
  },
  en: {
    desc: "AI-powered visual story and video creation platform.",
    product: "Product",
    pricing: "Pricing",
    features: "Features",
    signUp: "Sign Up",
    legal: "Legal",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    refund: "Refund Policy",
    company: "Company",
    about: "About Us",
    contact: "Contact",
    copyright: "© 2026 Phyix Technology. All rights reserved.",
    paymentAlt: "Payment methods",
  },
};

export function PublicFooter() {
  const { language } = useAppStore();
  const txt = footerText[language];

  return (
    <footer className="border-t border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="col-span-2 sm:col-span-1">
            <Link to="/">
              <img src={storiLyneLogo} alt="Storilyne" className="h-7 mb-3" />
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {txt.desc}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">{txt.product}</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><Link to="/pricing" className="hover:text-foreground transition-colors">{txt.pricing}</Link></li>
              <li><Link to="/features" className="hover:text-foreground transition-colors">{txt.features}</Link></li>
              <li><Link to="/auth" className="hover:text-foreground transition-colors">{txt.signUp}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">{txt.legal}</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-foreground transition-colors">{txt.privacy}</Link></li>
              <li><Link to="/terms" className="hover:text-foreground transition-colors">{txt.terms}</Link></li>
              <li><Link to="/refund" className="hover:text-foreground transition-colors">{txt.refund}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">{txt.company}</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground transition-colors">{txt.about}</Link></li>
              <li><Link to="/contact" className="hover:text-foreground transition-colors">{txt.contact}</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">{txt.copyright}</p>
          <div className="flex items-center justify-end w-full sm:w-auto">
            <img src="/logo_band_colored.svg" alt={txt.paymentAlt} className="h-8 opacity-80" />
          </div>
        </div>
      </div>
    </footer>
  );
}
