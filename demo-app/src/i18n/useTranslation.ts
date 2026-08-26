import { useDemoStore } from "@/state/store";
import { translations } from "./translations";

/**
 * `const t = useTranslation(); t("chat.title")`. Falls back to English,
 * then to the raw key, so a missing translation degrades to visible-but-odd
 * rather than a blank/crashing UI. Re-renders automatically when
 * Settings → Language changes, since it reads `language` from the store.
 */
export function useTranslation() {
  const language = useDemoStore((s) => s.language);
  return function t(key: string): string {
    return translations[language][key] ?? translations.en[key] ?? key;
  };
}
