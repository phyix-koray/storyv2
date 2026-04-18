import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import type { SubtitleOptions } from "@/lib/subtitles";

const FONT_FAMILIES = [
  { value: "sans-serif", label: "Sans-serif" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Monospace" },
  { value: "cursive", label: "Cursive" },
];

const TEXT_COLORS = [
  { value: "#ffffff", label: "Beyaz", class: "bg-white border border-border" },
  { value: "#facc15", label: "Sarı", class: "bg-yellow-400" },
  { value: "#4ade80", label: "Yeşil", class: "bg-green-400" },
  { value: "#60a5fa", label: "Mavi", class: "bg-blue-400" },
  { value: "#f87171", label: "Kırmızı", class: "bg-red-400" },
  { value: "#c084fc", label: "Mor", class: "bg-purple-400" },
];

interface SubtitleSettingsProps {
  options: SubtitleOptions;
  onChange: (options: SubtitleOptions) => void;
  language?: string;
}

export function SubtitleSettings({ options, onChange, language = "en" }: SubtitleSettingsProps) {
  const tr = language === "tr";

  const fontSizePercent = Math.round((options.fontSizeRatio ?? 0.035) * 1000);
  const bgOpacity = Math.round((options.bgAlpha ?? 0.6) * 100);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          {tr ? "Alt Yazı Ayarları" : "Subtitle Settings"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-4 z-[60]" align="start" side="bottom" sideOffset={8}>
        <p className="text-sm font-semibold text-foreground">
          {tr ? "Alt Yazı Stili" : "Subtitle Style"}
        </p>

        {/* Font Family */}
        <div className="space-y-1.5">
          <Label className="text-xs">{tr ? "Yazı Tipi" : "Font"}</Label>
          <Select
            value={options.fontFamily ?? "sans-serif"}
            onValueChange={(v) => onChange({ ...options, fontFamily: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_FAMILIES.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-xs">
                  <span style={{ fontFamily: f.value }}>{f.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Font Size */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{tr ? "Yazı Boyutu" : "Font Size"}</Label>
            <span className="text-xs text-muted-foreground">{fontSizePercent}%</span>
          </div>
          <Slider
            min={20}
            max={60}
            step={1}
            value={[fontSizePercent]}
            onValueChange={([v]) => onChange({ ...options, fontSizeRatio: v / 1000 })}
          />
        </div>

        {/* Font Weight */}
        <div className="space-y-1.5">
          <Label className="text-xs">{tr ? "Kalınlık" : "Weight"}</Label>
          <Select
            value={options.fontWeight ?? "bold"}
            onValueChange={(v) => onChange({ ...options, fontWeight: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal" className="text-xs">{tr ? "Normal" : "Normal"}</SelectItem>
              <SelectItem value="bold" className="text-xs">{tr ? "Kalın" : "Bold"}</SelectItem>
              <SelectItem value="900" className="text-xs">{tr ? "Çok Kalın" : "Extra Bold"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Text Color */}
        <div className="space-y-1.5">
          <Label className="text-xs">{tr ? "Yazı Rengi" : "Text Color"}</Label>
          <div className="flex gap-1.5 flex-wrap">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => onChange({ ...options, textColor: c.value })}
                className={`h-6 w-6 rounded-full transition-all ${c.class} ${
                  (options.textColor ?? "#ffffff") === c.value
                    ? "ring-2 ring-primary ring-offset-1 ring-offset-background scale-110"
                    : "hover:scale-105"
                }`}
                title={c.label}
              />
            ))}
          </div>
        </div>

        {/* Background Opacity */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{tr ? "Arka Plan Opaklığı" : "BG Opacity"}</Label>
            <span className="text-xs text-muted-foreground">{bgOpacity}%</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[bgOpacity]}
            onValueChange={([v]) => onChange({ ...options, bgAlpha: v / 100 })}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
