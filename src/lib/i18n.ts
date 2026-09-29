import { useSyncExternalStore } from "react";

export type Lang = "en" | "nl";

const STORAGE_KEY = "xsd-studio-lang";

const dict = {
  "nav.explorer": { en: "Explorer", nl: "Verkenner" },
  "nav.folder": { en: "Local folder", nl: "Lokale map" },
  "nav.generate": { en: "Test data", nl: "Testdata" },
  "nav.import": { en: "Import", nl: "Import" },
  "nav.compare": { en: "Compare", nl: "Vergelijken" },
  "nav.dependencies": { en: "Dependencies", nl: "Afhankelijkheden" },
  "nav.docs": { en: "Docs", nl: "Documentatie" },
  "header.prototype": { en: "prototype", nl: "prototype" },
  "header.schemasLoaded": { en: "schemas loaded", nl: "schema's geladen" },
  "header.schemaLoaded": { en: "schema loaded", nl: "schema geladen" },
  "header.toggleTheme": { en: "Toggle theme", nl: "Thema wisselen" },
  "header.toggleLanguage": { en: "Switch language", nl: "Taal wisselen" },
  "chat.title": { en: "AI schema assistant", nl: "AI schema assistent" },
  "chat.clear": { en: "Clear", nl: "Wissen" },
  "chat.intro": {
    en: "Ask a question about",
    nl: "Stel een vraag over",
  },
  "chat.introTail": {
    en: "— structure, types, restrictions or errors.",
    nl: "— structuur, types, restricties of fouten.",
  },
  "chat.yourSchema": { en: "your schema", nl: "je schema" },
  "chat.s1": { en: "Explain the structure of this schema", nl: "Leg de structuur van dit schema uit" },
  "chat.s2": { en: "Which restrictions apply?", nl: "Welke restricties gelden er?" },
  "chat.s3": { en: "How do I fix the validation errors?", nl: "Hoe los ik de validatiefouten op?" },
  "chat.thinking": { en: "Thinking...", nl: "Denkt na..." },
  "chat.noAnswer": { en: "No answer received. Please try again.", nl: "Geen antwoord ontvangen. Probeer het opnieuw." },
  "chat.placeholder": { en: "Ask something about this XSD...", nl: "Vraag iets over dit XSD..." },
  "chat.disclaimer": { en: "AI answers are indicative", nl: "AI-antwoorden zijn indicatief" },
  "chat.stop": { en: "Stop", nl: "Stop" },
  "chat.ask": { en: "Ask", nl: "Vraag" },
  "footer.clientSide": {
    en: "Client-side XSD analysis",
    nl: "XSD-analyse in de browser",
  },
  "footer.synthetic": {
    en: "Synthetic demo data only",
    nl: "Alleen synthetische demodata",
  },
  "footer.ai": {
    en: "AI-assisted findings are illustrative and need human review",
    nl: "AI-resultaten zijn illustratief en vereisen menselijke controle",
  },
} as const;

export type TranslationKey = keyof typeof dict;

let current: Lang = "en";
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function initLanguage() {
  if (typeof window === "undefined") return;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "nl") {
    current = stored;
    document.documentElement.lang = stored;
    notify();
  }
}

export function setLanguage(lang: Lang) {
  current = lang;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useLanguage() {
  const lang = useSyncExternalStore(
    subscribe,
    () => current,
    () => "en" as Lang,
  );
  const t = (key: TranslationKey) => dict[key][lang];
  return { lang, t, setLanguage };
}
