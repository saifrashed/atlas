import type { XmlNode } from "@/lib/xml/parse";
import { inlineValue } from "@/lib/xml/parse";
import type { XsdNode } from "@/lib/xsd/types";

export type DiagramKind =
  | "element"
  | "attribute"
  | "compositor"
  | "value"
  | "type"
  | "reference";

export interface DiagramNode {
  id: string;
  label: string;
  sub?: string | undefined;
  kind: DiagramKind;
  compositor?: "sequence" | "choice" | "all" | undefined;
  occurs?: string | undefined;
  optional?: boolean | undefined;
  repeated?: boolean | undefined;
  children: DiagramNode[];
}

export interface PlacedNode {
  node: DiagramNode;
  x: number;
  y: number;
  w: number;
  h: number;
  cy: number;
  hasChildren: boolean;
  collapsed: boolean;
}

export interface Edge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  mid: number;
  optional?: boolean | undefined;
}

export interface Layout {
  nodes: PlacedNode[];
  edges: Edge[];
  width: number;
  height: number;
}

const CHAR = 6.9;
const SUB_CHAR = 5.8;
const PAD_X = 22;
const H_GAP = 54;
const V_GAP = 12;
const COMPOSITOR_W = 38;
const COMPOSITOR_H = 24;

function boxSize(node: DiagramNode) {
  if (node.kind === "compositor") return { w: COMPOSITOR_W, h: COMPOSITOR_H };
  const labelW = node.label.length * CHAR;
  const subW = node.sub ? node.sub.length * SUB_CHAR : 0;
  return {
    w: Math.max(74, Math.min(300, Math.max(labelW, subW) + PAD_X)),
    h: node.sub ? 40 : 28,
  };
}

export function layoutDiagram(
  root: DiagramNode,
  collapsed: Set<string>,
  startX = 24,
  startY = 24,
): Layout {
  const nodes: PlacedNode[] = [];
  const edges: Edge[] = [];
  let maxX = 0;

  function place(node: DiagramNode, x: number, top: number): { bottom: number; cy: number } {
    const { w, h } = boxSize(node);
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;
    maxX = Math.max(maxX, x + w + 30);

    if (!hasChildren || isCollapsed) {
      const cy = top + h / 2;
      nodes.push({ node, x, y: top, w, h, cy, hasChildren, collapsed: isCollapsed });
      return { bottom: top + h, cy };
    }

    const childX = x + w + H_GAP;
    let cursor = top;
    const childCenters: number[] = [];
    for (const child of node.children) {
      const res = place(child, childX, cursor);
      childCenters.push(res.cy);
      cursor = res.bottom + V_GAP;
    }
    const first = childCenters[0] ?? top;
    const last = childCenters[childCenters.length - 1] ?? top;
    const cy = (first + last) / 2;
    const y = cy - h / 2;
    nodes.push({ node, x, y, w, h, cy, hasChildren, collapsed: false });

    node.children.forEach((child, i) => {
      edges.push({
        id: `${node.id}->${child.id}`,
        x1: x + w,
        y1: cy,
        x2: childX,
        y2: childCenters[i] ?? cy,
        mid: x + w + H_GAP / 2,
        optional: child.optional,
      });
    });

    return { bottom: Math.max(cursor - V_GAP, y + h), cy };
  }

  const res = place(root, startX, startY);
  return { nodes, edges, width: maxX, height: res.bottom + 32 };
}

/* ---------- adapters ---------- */

export function xmlToDiagram(node: XmlNode): DiagramNode {
  const value = inlineValue(node);
  const children: DiagramNode[] = [];

  for (const attr of node.attributes) {
    children.push({
      id: `${node.id}@${attr.name}`,
      label: attr.name,
      sub: attr.value,
      kind: "attribute",
      optional: true,
      children: [],
    });
  }
  for (const child of node.children) {
    if (child.kind === "text" && value !== undefined) continue;
    children.push(xmlToDiagram(child));
  }

  const kind: DiagramKind = node.kind === "element" ? "element" : "value";
  return {
    id: node.id,
    label: node.name,
    sub: value ?? (node.kind === "element" ? undefined : node.value),
    kind,
    children,
  };
}

const SKIP: ReadonlySet<string> = new Set(["documentation", "import", "include", "other"]);

export function xsdToDiagram(node: XsdNode): DiagramNode {
  const children: DiagramNode[] = [];
  for (const child of node.children) {
    if (SKIP.has(child.kind)) continue;
    children.push(xsdToDiagram(child));
  }

  const compositor =
    node.kind === "sequence" || node.kind === "choice" || node.kind === "all"
      ? node.kind
      : undefined;

  const kind: DiagramKind = compositor
    ? "compositor"
    : node.kind === "attribute"
      ? "attribute"
      : node.kind === "element"
        ? "element"
        : node.kind === "enumeration"
          ? "value"
          : "type";

  const min = node.minOccurs;
  const max = node.maxOccurs;
  const occurs = min || max ? `${min ?? "1"}..${max ?? "1"}` : undefined;

  const result: DiagramNode = {
    id: node.id,
    label: node.name ?? node.kind,
    kind,
    children,
    optional: min === "0" || node.use === "optional",
    repeated: max === "unbounded" || (max !== undefined && Number(max) > 1),
  };
  if (compositor) result.compositor = compositor;
  if (occurs && occurs !== "1..1") result.occurs = occurs;
  if (!compositor) result.sub = node.type ?? node.base ?? node.value;
  return result;
}
