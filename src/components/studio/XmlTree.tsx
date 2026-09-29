import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { inlineValue, nodeMatches, type XmlNode } from "@/lib/xml/parse";
import { cn } from "@/lib/utils";

const KIND_BADGE: Record<XmlNode["kind"], { label: string; className: string }> = {
  element: { label: "E", className: "text-kind-element" },
  text: { label: "T", className: "text-kind-simple" },
  cdata: { label: "D", className: "text-kind-enum" },
  comment: { label: "#", className: "text-muted-foreground" },
  processing: { label: "?", className: "text-muted-foreground" },
};

function Row({
  node,
  query,
  selectedId,
  onSelect,
  expandSignal,
}: {
  node: XmlNode;
  query: string;
  selectedId?: string | undefined;
  onSelect: (n: XmlNode) => void;
  expandSignal: { n: number; open: boolean };
}) {
  const [open, setOpen] = useState(node.depth < 2);
  useEffect(() => {
    if (expandSignal.n > 0) setOpen(expandSignal.open);
  }, [expandSignal]);
  const isOpen = Boolean(query) || open;

  const value = inlineValue(node);
  const visibleChildren = node.children.filter(
    (c) => nodeMatches(c, query) && !(c.kind === "text" && value !== undefined),
  );
  const hasChildren = visibleChildren.length > 0;
  const badge = KIND_BADGE[node.kind];
  const selected = selectedId === node.id;

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={selected}
        aria-expanded={hasChildren ? isOpen : undefined}
        tabIndex={0}
        onClick={() => onSelect(node)}
        onKeyDown={(e) => e.key === "Enter" && onSelect(node)}
        style={{ paddingLeft: node.depth * 14 + 6 }}
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded-sm py-[3px] pr-2 font-mono text-xs transition-colors",
          selected ? "bg-accent text-accent-foreground" : "hover:bg-secondary",
        )}
      >
        <button
          type="button"
          aria-label={isOpen ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!isOpen);
          }}
          className="flex size-4 items-center justify-center text-muted-foreground"
        >
          {hasChildren ? (
            isOpen ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )
          ) : null}
        </button>
        <span className={cn("w-4 shrink-0 text-center text-[10px] font-bold", badge.className)}>
          {badge.label}
        </span>
        <span className="truncate">{node.name}</span>
        {node.attributes.slice(0, 4).map((a) => (
          <span key={a.name} className="shrink-0 text-[11px] text-muted-foreground">
            <span className="text-kind-attribute">{a.name}</span>=
            <span className="text-syntax-value">&quot;{a.value}&quot;</span>
          </span>
        ))}
        {node.attributes.length > 4 && (
          <span className="text-[10px] text-muted-foreground">+{node.attributes.length - 4}</span>
        )}
        {value !== undefined && (
          <span className="truncate text-syntax-value">= {value}</span>
        )}
        {node.kind !== "element" && node.value && value === undefined && (
          <span className="truncate text-muted-foreground">{node.value}</span>
        )}
      </div>
      {isOpen && hasChildren && (
        <div className="tree-guide ml-[13px]">
          {visibleChildren.map((child) => (
            <Row
              key={child.id}
              node={child}
              query={query}
              selectedId={selectedId}
              onSelect={onSelect}
              expandSignal={expandSignal}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function XmlTree({
  root,
  query,
  selectedId,
  onSelect,
  zoom = 1,
  expandSignal = { n: 0, open: true },
}: {
  root?: XmlNode | undefined;
  query: string;
  selectedId?: string | undefined;
  onSelect: (n: XmlNode) => void;
  zoom?: number | undefined;
  expandSignal?: { n: number; open: boolean } | undefined;
}) {
  const q = query.trim().toLowerCase();
  if (!root) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        No document loaded. Drop an .xml file or paste markup to begin.
      </p>
    );
  }
  if (!nodeMatches(root, q)) {
    return <p className="p-4 text-xs text-muted-foreground">No nodes match your search.</p>;
  }
  return (
    <div
      role="tree"
      className="origin-top-left p-2"
      style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}
    >
      <Row
        node={root}
        query={q}
        selectedId={selectedId}
        onSelect={onSelect}
        expandSignal={expandSignal}
      />
    </div>
  );
}
