import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { XsdNode, XsdNodeKind } from "@/lib/xsd/types";
import { cn } from "@/lib/utils";

const KIND_STYLE: Partial<Record<XsdNodeKind, { label: string; className: string }>> = {
  element: { label: "E", className: "text-kind-element" },
  complexType: { label: "C", className: "text-kind-complex" },
  simpleType: { label: "S", className: "text-kind-simple" },
  attribute: { label: "A", className: "text-kind-attribute" },
  enumeration: { label: "V", className: "text-kind-enum" },
  sequence: { label: "≡", className: "text-muted-foreground" },
  choice: { label: "◇", className: "text-muted-foreground" },
  all: { label: "∀", className: "text-muted-foreground" },
  restriction: { label: "R", className: "text-muted-foreground" },
  extension: { label: "X", className: "text-muted-foreground" },
  import: { label: "↧", className: "text-muted-foreground" },
  include: { label: "↦", className: "text-muted-foreground" },
  group: { label: "G", className: "text-muted-foreground" },
  attributeGroup: { label: "AG", className: "text-muted-foreground" },
};

function matches(node: XsdNode, q: string): boolean {
  if (!q) return true;
  const hay = `${node.name ?? ""} ${node.type ?? ""} ${node.kind} ${node.value ?? ""}`.toLowerCase();
  return hay.includes(q) || node.children.some((c) => matches(c, q));
}

function TreeRow({
  node,
  depth,
  query,
  selectedId,
  onSelect,
  defaultOpen,
}: {
  node: XsdNode;
  depth: number;
  query: string;
  selectedId?: string | undefined;
  onSelect: (n: XsdNode) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(depth < 2 || defaultOpen);
  const visibleChildren = node.children.filter((c) => matches(c, query));
  const hasChildren = visibleChildren.length > 0;
  const style = KIND_STYLE[node.kind] ?? { label: "•", className: "text-muted-foreground" };
  const selected = selectedId === node.id;

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={selected}
        tabIndex={0}
        onClick={() => onSelect(node)}
        onKeyDown={(e) => e.key === "Enter" && onSelect(node)}
        style={{ paddingLeft: depth * 14 + 6 }}
        className={cn(
          "group flex cursor-pointer items-center gap-1 rounded-sm py-[3px] pr-2 font-mono text-xs transition-colors",
          selected ? "bg-accent text-accent-foreground" : "hover:bg-secondary",
        )}
      >
        <button
          type="button"
          aria-label={open ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="flex size-4 items-center justify-center text-muted-foreground"
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )
          ) : null}
        </button>
        <span className={cn("w-4 shrink-0 text-center text-[10px] font-bold", style.className)}>
          {style.label}
        </span>
        <span className="truncate">{node.name ?? node.kind}</span>
        {node.type && <span className="truncate text-muted-foreground">: {node.type}</span>}
        {node.value && <span className="truncate text-syntax-value">= {node.value}</span>}
        {(node.minOccurs || node.maxOccurs) && (
          <span className="ml-1 shrink-0 text-[10px] text-muted-foreground">
            [{node.minOccurs ?? "1"}..{node.maxOccurs ?? "1"}]
          </span>
        )}
      </div>
      {open && hasChildren && (
        <div className="tree-guide ml-[13px]">
          {visibleChildren.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              query={query}
              selectedId={selectedId}
              onSelect={onSelect}
              defaultOpen={Boolean(query)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SchemaTree({
  root,
  query,
  selectedId,
  onSelect,
  zoom = 1,
}: {
  root?: XsdNode | undefined;
  query: string;
  selectedId?: string | undefined;
  onSelect: (n: XsdNode) => void;
  zoom?: number | undefined;
}) {
  const q = query.trim().toLowerCase();
  const children = useMemo(
    () => (root?.children ?? []).filter((c) => matches(c, q)),
    [root, q],
  );

  if (!root) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        No schema selected. Upload an .xsd file to begin.
      </p>
    );
  }

  return (
    <div
      role="tree"
      className="origin-top-left p-2"
      style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}
    >
      {children.length === 0 ? (
        <p className="p-4 text-xs text-muted-foreground">No components match your search.</p>
      ) : (
        children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={0}
            query={q}
            selectedId={selectedId}
            onSelect={onSelect}
            defaultOpen={Boolean(q)}
          />
        ))
      )}
    </div>
  );
}
