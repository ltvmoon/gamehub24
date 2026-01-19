import { create } from "zustand";
import { persist } from "zustand/middleware";

export const Language = {
  en: "en",
  vi: "vi",
} as const;

export type Language = (typeof Language)[keyof typeof Language];

export type ITransable =
  | string
  | number
  | { vi: string | React.ReactNode; en: string | React.ReactNode };

interface LanguageStore {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: Language.vi,
      setLanguage: (language: Language) => set({ language }),
    }),
    {
      name: "gamehub_language",
    },
  ),
);

export const trans = (
  obj: ITransable | undefined | null,
  language = useLanguageStore.getState().language,
): string | React.ReactNode => {
  if (obj == null) return "";
  if (typeof obj === "string" || typeof obj === "number") return obj;
  return obj[language] ?? obj[Language.en] ?? "?";
};

// String-only version for attributes like placeholder, title, etc.
export const transString = (
  obj: { vi: string; en: string } | string | undefined | null,
  language = useLanguageStore.getState().language,
): string => {
  if (obj == null) return "";
  if (typeof obj === "string") return obj;
  return obj[language] ?? obj[Language.en] ?? "?";
};

export default function useLanguage() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  return {
    language,
    setLanguage,
    ti: (obj: ITransable | undefined | null) => trans(obj, language),
    ts: (obj: { vi: string; en: string } | string | undefined | null) =>
      transString(obj, language),
  };
}
