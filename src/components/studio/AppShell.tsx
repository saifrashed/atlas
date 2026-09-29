import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  Boxes,
  GitCompareArrows,
  Network,
  BookText,
  FolderOpen,
  FileStack,

  Languages,
  Moon,
  Sun,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { initTheme, loadSamples, setTheme, useStudio } from "@/lib/store";
import { initLanguage, useLanguage, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AtlasLogo } from "./AtlasLogo";

interface NavItem {
  to: string;
  key: TranslationKey;
  icon: typeof Boxes;
}

interface NavGroup extends NavItem {
  items: NavItem[];
}

/** Two top-level areas; everything else lives in a second bar inside the area. */
const NAV: NavGroup[] = [
  {
    to: "/",
    key: "nav.explorer",
    icon: Boxes,
    items: [
      { to: "/", key: "nav.explorer", icon: Boxes },
      { to: "/folder", key: "nav.folder", icon: FolderOpen },
      { to: "/compare", key: "nav.compare", icon: GitCompareArrows },
      { to: "/dependencies", key: "nav.dependencies", icon: Network },
      { to: "/documentation", key: "nav.docs", icon: BookText },
    ],
  },
  {
    to: "/generate",
    key: "nav.generate",
    icon: Wand2,
    items: [
      { to: "/generate", key: "nav.generate", icon: Wand2 },
      { to: "/import", key: "nav.import", icon: FileStack },
    ],
  },
];



export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const theme = useStudio((s) => s.theme);
  const count = useStudio((s) => s.schemas.length);
  const { lang, t, setLanguage } = useLanguage();
  const activeGroup =
    NAV.find((g) => g.items.some((i) => i.to === pathname)) ?? NAV[0]!;

  useEffect(() => {
    initTheme();
    loadSamples();
    initLanguage();
  }, []);


  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b bg-panel px-3">
        <AtlasLogo />
        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-md bg-secondary/40 p-0.5">
          {NAV.map((group) => {
            const active = group === activeGroup;
            return (
              <Link
                key={group.to}
                to={group.to}
                title={t(group.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <group.icon className="size-3.5 shrink-0" />
                {t(group.key)}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <span className="hidden font-mono text-[11px] text-muted-foreground xl:inline">
            {count} {count === 1 ? t("header.schemaLoaded") : t("header.schemasLoaded")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 font-mono text-[11px]"
            aria-label={t("header.toggleLanguage")}
            title={t("header.toggleLanguage")}
            onClick={() => setLanguage(lang === "en" ? "nl" : "en")}
          >
            <Languages className="size-4" />
            {lang.toUpperCase()}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("header.toggleTheme")}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </header>
      <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b bg-background px-3">
        {activeGroup.items.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-1.5 text-xs transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="size-3.5 shrink-0" />
              {t(item.key)}
            </Link>
          );
        })}
      </div>
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      <footer className="flex h-6 shrink-0 items-center gap-4 rail-surface px-3 font-mono text-[10px] text-muted-foreground">
        <span>{t("footer.clientSide")}</span>
        <span>{t("footer.synthetic")}</span>
        <span className="ml-auto">{t("footer.ai")}</span>
      </footer>
    </div>
  );
}
