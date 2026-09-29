import { useEffect, useState } from "react";

const SEEN_KEY = "atlas-splash-seen";

export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SEEN_KEY)) return;
    sessionStorage.setItem(SEEN_KEY, "1");
    setVisible(true);
    const fadeTimer = setTimeout(() => setFading(true), 1400);
    const hideTimer = setTimeout(() => setVisible(false), 1900);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-label="Atlas"
    >
      <svg
        viewBox="0 0 48 40"
        className="size-28 animate-scale-in text-primary"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M24 3 L45 37 L3 37 Z" />
        <path d="M24 15 L34 31 L14 31 Z" opacity="0.8" />
        <path d="M6 31 L14 31 M34 31 L42 31" opacity="0.5" />
      </svg>
      <div className="mt-6 animate-fade-in text-2xl font-semibold uppercase tracking-[0.5em] text-foreground">
        Atlas
      </div>
      <div className="mt-3 animate-fade-in font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        XSD &amp; XML workbench &middot; prototype
      </div>
      <div className="mt-8 h-0.5 w-40 overflow-hidden rounded bg-secondary">
        <div className="h-full w-1/3 animate-[slide-in-right_1.4s_ease-in-out_infinite] bg-primary" />
      </div>
    </div>
  );
}
