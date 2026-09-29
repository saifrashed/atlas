export function AtlasLogo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <svg
          viewBox="0 0 48 40"
          className="size-6 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* outer peak */}
          <path d="M24 3 L45 37 L3 37 Z" className="text-primary" stroke="currentColor" />
          {/* inner peak */}
          <path d="M24 15 L34 31 L14 31 Z" className="text-accent-foreground" opacity="0.85" />
          {/* base line */}
          <path d="M6 31 L14 31 M34 31 L42 31" opacity="0.6" />
        </svg>
        <span className="text-sm font-semibold uppercase tracking-[0.25em]">Atlas</span>
      </div>
    </div>
  );
}
