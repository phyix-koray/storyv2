import { useAppStore } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LanguageSelector() {
  const { language, setLanguage } = useAppStore();

  return (
    <Select value={language} onValueChange={(v) => setLanguage(v as "tr" | "en")}>
      <SelectTrigger className="w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="tr">🇹🇷 Türkçe</SelectItem>
        <SelectItem value="en">🇬🇧 English</SelectItem>
      </SelectContent>
    </Select>
  );
}
