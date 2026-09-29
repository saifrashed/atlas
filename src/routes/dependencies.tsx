import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/studio/AppShell";
import { useStudio } from "@/lib/store";

export const Route = createFileRoute("/dependencies")({
  head: () => ({
    meta: [
      { title: "Dependency Graph — XSD Studio" },
      {
        name: "description",
        content:
          "Visualize imports and includes between XSD schemas as an interactive dependency graph.",
      },
      { property: "og:title", content: "Dependency Graph — XSD Studio" },
      {
        property: "og:description",
        content: "See how your XSD schemas import and include each other.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DependenciesPage,
});

interface GraphNode {
  id: string;
  label: string;
  external: boolean;
  x: number;
  y: number;
}

function DependenciesPage() {
  const schemas = useStudio((s) => s.schemas);

  const { nodes, edges } = useMemo(() => {
    const map = new Map<string, GraphNode>();
    const list: { from: string; to: string; kind: string }[] = [];

    schemas.forEach((s) => {
      map.set(s.fileName, { id: s.fileName, label: s.fileName, external: false, x: 0, y: 0 });
    });
    schemas.forEach((s) => {
      s.dependencies.forEach((d) => {
        const target = d.location ?? d.namespace ?? "unknown";
        if (!map.has(target)) {
          map.set(target, { id: target, label: target, external: true, x: 0, y: 0 });
        }
        list.push({ from: s.fileName, to: target, kind: d.kind });
      });
    });

    const all = Array.from(map.values());
    const roots = all.filter((n) => !n.external);
    const leaves = all.filter((n) => n.external);
    roots.forEach((n, i) => {
      n.x = 170;
      n.y = 70 + i * 90;
    });
    leaves.forEach((n, i) => {
      n.x = 600;
      n.y = 70 + i * 90;
    });
    return { nodes: all, edges: list };
  }, [schemas]);

  const height = Math.max(320, nodes.length * 90 + 60);

  return (
    <AppShell>
      <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_320px]">
        <section className="min-h-0 overflow-auto ide-grid p-4">
          <h1 className="mb-3 text-sm font-semibold">Schema dependency graph</h1>
          <svg width="860" height={height} className="max-w-full">
            <defs>
              <marker
                id="arrow"
                markerWidth="8"
                markerHeight="8"
                refX="8"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 z" fill="var(--color-muted-foreground)" />
              </marker>
            </defs>
            {edges.map((e, i) => {
              const from = nodes.find((n) => n.id === e.from);
              const to = nodes.find((n) => n.id === e.to);
              if (!from || !to) return null;
              const x1 = from.x + 140;
              const y1 = from.y + 20;
              const x2 = to.x - 6;
              const y2 = to.y + 20;
              const mid = (x1 + x2) / 2;
              return (
                <g key={i}>
                  <path
                    d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke="var(--color-muted-foreground)"
                    strokeWidth={1.2}
                    strokeDasharray={e.kind === "include" ? "4 3" : undefined}
                    markerEnd="url(#arrow)"
                  />
                  <text
                    x={mid}
                    y={(y1 + y2) / 2 - 6}
                    textAnchor="middle"
                    className="fill-muted-foreground font-mono"
                    fontSize="9"
                  >
                    {e.kind}
                  </text>
                </g>
              );
            })}
            {nodes.map((n) => (
              <g key={n.id}>
                <rect
                  x={n.x}
                  y={n.y}
                  width={140}
                  height={40}
                  rx={6}
                  fill="var(--color-card)"
                  stroke={n.external ? "var(--color-modified)" : "var(--color-primary)"}
                  strokeWidth={1.4}
                />
                <text
                  x={n.x + 10}
                  y={n.y + 18}
                  className="fill-foreground font-mono"
                  fontSize="10"
                >
                  {n.label.length > 20 ? `${n.label.slice(0, 19)}…` : n.label}
                </text>
                <text
                  x={n.x + 10}
                  y={n.y + 31}
                  className="fill-muted-foreground font-mono"
                  fontSize="8"
                >
                  {n.external ? "external reference" : "in workspace"}
                </text>
              </g>
            ))}
          </svg>
        </section>

        <aside className="min-h-0 overflow-y-auto border-l panel-surface p-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Imports &amp; includes
          </h2>
          <ul className="mt-2 space-y-2">
            {schemas.map((s) => (
              <li key={s.id} className="rounded border bg-card p-2 text-xs">
                <p className="font-mono font-medium">{s.fileName}</p>
                {s.dependencies.length === 0 ? (
                  <p className="mt-1 text-muted-foreground">No external dependencies.</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-muted-foreground">
                    {s.dependencies.map((d, i) => (
                      <li key={i}>
                        {d.kind} → {d.location ?? d.namespace}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
