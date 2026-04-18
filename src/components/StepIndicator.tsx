import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const steps = [1, 2, 3, 4] as const;
const stepKeys = ["step1", "step2", "step3", "step4"] as const;

export function StepIndicator() {
  const { step, language, images, scenes, videoUrl, setStep } = useAppStore();

  const canNavigate = (s: number) => {
    if (s === step) return false;
    if (s < step) return true;
    if (s === 2 && scenes.length > 0) return true;
    if (s === 3 && images.length > 0) return true;
    if (s === 4 && images.length > 0) return true;
    return false;
  };

  const handleStepClick = (s: number) => {
    if (canNavigate(s)) setStep(s as 1 | 2 | 3 | 4);
  };

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {steps.map((s, i) => {
        const isClickable = canNavigate(s);
        return (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn("flex flex-col items-center gap-1", isClickable && "cursor-pointer")}
              onClick={() => isClickable && handleStepClick(s)}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all",
                  s === step
                    ? "bg-primary text-primary-foreground shadow-md"
                    : s < step
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {s}
              </div>
              <span className={cn("text-xs", s === step ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {t(language, stepKeys[i])}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("h-0.5 w-8 md:w-16 rounded-full", s < step ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
