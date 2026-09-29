import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { layoutDiagram, type DiagramNode, type PlacedNode } from "@/lib/diagram/layout";
import { cn } from "@/lib/utils";

const KIND_COLOR: Record<string, string> = {
  element: "var(--kind-element)",
  attribute: "var(--kind-attribute)",
  value: "var(--kind-simple)",
  type: "var(--kind-complex)",
  compositor: "var(--muted-foreground)",
  reference: "var(--kind-enum)",
};

function truncate(text: string, w: number, size: number) {
  const max = Math.floor((w - 16) / size);
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;
}

function Compositor({ p }: { p: PlacedNode }) {
  const cx = p.x + p.w / 2;
  const cy = p.cy;
  const type = p.node.compositor ?? "sequence";
  const dots = [-8, 0, 8];
  return (
    <g>
      <rect
        x={p.x}
        y={p.y}
        width={p.w}
        height={p.h}
        rx={p.h / 2}
        fill="var(--secondary)"
        stroke="var(--muted-foreground)"
        strokeWidth={1}
      />
      {type === "sequence" &&
        dots.map((d) => <circle key={d} cx={cx + d} cy={cy} r={1.8} fill="var(--foreground)" />)}
      {type === "choice" && (
        <>
          <path
            d={`M ${cx - 10} ${cy} H ${cx + 10}`}
            stroke="var(--foreground)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
          {dots.map((d) => (
            <circle key={d} cx={cx + d} cy={cy - 5} r={1.6} fill="var(--foreground)" />
          ))}
          {dots.map((d) => (
            <circle key={`b${d}`} cx={cx + d} cy={cy + 5} r={1.6} fill="var(--foreground)" />
          ))}
        </>
      )}
      {type === "all" && (
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={11}
          fill="var(--foreground)"
          fontFamily="var(--font-mono)"
        >
          all
        </text>
      )}
    </g>
  );
}

export function DiagramView({
  root,
  zoom = 1,
  selectedId,
  onSelect,
  collapsed,
  onToggle,
  emptyLabel = "Nothing to diagram yet.",
}: {
  root?: DiagramNode | undefined;
  zoom?: number | undefined;
  selectedId?: string | undefined;
  onSelect?: ((node: DiagramNode) => void) | undefined;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  emptyLabel?: string | undefined;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [panning, setPanning] = useState(false);
  const origin = useRef({ x: 0, y: 0, left: 0, top: 0 });

  const layout = useMemo(
    () => (root ? layoutDiagram(root, collapsed) : undefined),
    [root, collapsed],
  );

  if (!root || !layout) {
    return <p className="p-6 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const startPan = (e: ReactMouseEvent) => {
    if (e.button !== 0 || !scrollRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-node]")) return;
    setPanning(true);
    origin.current = {
      x: e.clientX,
      y: e.clientY,
      left: scrollRef.current.scrollLeft,
      top: scrollRef.current.scrollTop,
    };
  };
  const movePan = (e: ReactMouseEvent) => {
    if (!panning || !scrollRef.current) return;
    scrollRef.current.scrollLeft = origin.current.left - (e.clientX - origin.current.x);
    scrollRef.current.scrollTop = origin.current.top - (e.clientY - origin.current.y);
  };

  return (
    <div
      ref={scrollRef}
      onMouseDown={startPan}
      onMouseMove={movePan}
      onMouseUp={() => setPanning(false)}
      onMouseLeave={() => setPanning(false)}
      className={cn("h-full w-full overflow-auto ide-grid", panning ? "cursor-grabbing" : "cursor-grab")}
    >
      <svg
        width={layout.width * zoom}
        height={layout.height * zoom}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="select-none"
        fontFamily="var(--font-mono)"
      >
        {layout.edges.map((e) => (
          <path
            key={e.id}
            d={`M ${e.x1} ${e.y1} H ${e.mid} V ${e.y2} H ${e.x2}`}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1.25}
            strokeDasharray={e.optional ? "4 3" : undefined}
          />
        ))}

        {layout.nodes.map((p) => {
          if (p.node.kind === "compositor") {
            return (
              <g
                key={p.node.id}
                data-node
                className="cursor-pointer"
                onClick={() => onSelect?.(p.node)}
              >
                <Compositor p={p} />
                {p.hasChildren && (
                  <Toggle p={p} onToggle={onToggle} />
                )}
              </g>
            );
          }

          const color = KIND_COLOR[p.node.kind] ?? "var(--border)";
          const selected = selectedId === p.node.id;
          return (
            <g
              key={p.node.id}
              data-node
              className="cursor-pointer"
              onClick={() => onSelect?.(p.node)}
            >
              <rect
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                rx={4}
                fill={selected ? "var(--accent)" : "var(--card)"}
                stroke={color}
                strokeWidth={selected ? 2 : 1.25}
                strokeDasharray={p.node.optional ? "5 3" : undefined}
              />
              <rect x={p.x} y={p.y} width={3} height={p.h} fill={color} rx={1.5} />
              <text
                x={p.x + 10}
                y={p.node.sub ? p.y + 17 : p.y + 18}
                fontSize={11.5}
                fill="var(--foreground)"
                fontWeight={500}
              >
                {truncate(p.node.label, p.w, 6.9)}
              </text>
              {p.node.sub && (
                <text x={p.x + 10} y={p.y + 31} fontSize={10} fill="var(--muted-foreground)">
                  {truncate(p.node.sub, p.w, 5.8)}
                </text>
              )}
              {p.node.occurs && (
                <text
                  x={p.x + p.w / 2}
                  y={p.y - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--muted-foreground)"
                >
                  {p.node.occurs}
                </text>
              )}
              {p.node.repeated && (
                <path
                  d={`M ${p.x + 4} ${p.y + p.h + 3} H ${p.x + p.w - 4}`}
                  stroke={color}
                  strokeWidth={1.25}
                />
              )}
              {p.hasChildren && <Toggle p={p} onToggle={onToggle} />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Toggle({ p, onToggle }: { p: PlacedNode; onToggle: (id: string) => void }) {
  const x = p.x + p.w;
  const y = p.cy;
  return (
    <g
      data-node
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(p.node.id);
      }}
    >
      <rect
        x={x - 1}
        y={y - 6}
        width={12}
        height={12}
        rx={2}
        fill="var(--card)"
        stroke="var(--muted-foreground)"
      />
      <path d={`M ${x + 2} ${y} H ${x + 8}`} stroke="var(--foreground)" strokeWidth={1.3} />
      {p.collapsed && (
        <path d={`M ${x + 5} ${y - 3} V ${y + 3}`} stroke="var(--foreground)" strokeWidth={1.3} />
      )}
    </g>
  );
}
