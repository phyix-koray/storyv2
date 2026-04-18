import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard, Mail } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";

interface CreditExhaustedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: "en" | "tr";
  requiredAmount?: number;
}

export function CreditExhaustedDialog({ open, onOpenChange, language, requiredAmount }: CreditExhaustedDialogProps) {
  const navigate = useNavigate();
  const { plan } = useCredits();
  const tr = language === "tr";
  const isMaxPlan = plan === "growth" || plan === "agency";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center">
            {tr ? "Yetersiz Kredi" : "Insufficient Credits"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {requiredAmount
              ? (tr
                ? `Bu işlem $${requiredAmount.toFixed(2)} gerektiriyor. Lütfen planınızı yükseltin veya kredi yükleyin.`
                : `This action requires $${requiredAmount.toFixed(2)}. Please upgrade your plan or top up credits.`)
              : (tr
                ? "Krediniz tükendi. Devam etmek için planınızı yükseltin."
                : "You've run out of credits. Upgrade your plan to continue.")
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          {!isMaxPlan && (
            <Button
              size="lg"
              className="w-full brand-gradient-bg text-white border-0 hover:opacity-90"
              onClick={() => { onOpenChange(false); navigate("/pricing"); }}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {tr ? "Planı Yükselt" : "Upgrade Plan"}
            </Button>
          )}
          {isMaxPlan && (
            <>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => { onOpenChange(false); navigate("/pricing"); }}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {tr ? "Kredi Yükle" : "Top Up Credits"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => { onOpenChange(false); navigate("/contact"); }}
              >
                <Mail className="mr-2 h-4 w-4" />
                {tr ? "Satış Ekibiyle İletişim" : "Contact Sales"}
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {tr ? "Kapat" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
