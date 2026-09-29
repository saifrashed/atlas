import type { ParsedSchema, XsdNode, XsdNodeKind } from "./types";

const escAttr = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escText = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function tagFor(node: XsdNode, pfx: string) {
  return node.tag ?? `${pfx}${node.kind}`;
}

function serializeNode(node: XsdNode, depth: number, pfx: string): string {
  const pad = "  ".repeat(depth);
  const tag = tagFor(node, pfx);
  const attrs = Object.entries(node.attributes)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => ` ${k}="${escAttr(v)}"`)
    .join("");

  const inner: string[] = [];
  if (node.documentation) {
    inner.push(
      `${pad}  <${pfx}annotation>\n${pad}    <${pfx}documentation>${escText(
        node.documentation,
      )}</${pfx}documentation>\n${pad}  </${pfx}annotation>`,
    );
  }
  for (const child of node.children) inner.push(serializeNode(child, depth + 1, pfx));

  if (!inner.length) return `${pad}<${tag}${attrs}/>`;
  return `${pad}<${tag}${attrs}>\n${inner.join("\n")}\n${pad}</${tag}>`;
}

/** Re-generate XSD source text from the (possibly edited) node tree. */
export function serializeSchema(schema: ParsedSchema): string {
  if (!schema.root) return schema.content;
  const pfx = schema.prefix ? `${schema.prefix}:` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serializeNode(schema.root, 0, pfx)}\n`;
}

/** Attribute names that mirror first-class fields on XsdNode. */
export const FIELD_ATTRS = {
  name: "name",
  type: "type",
  base: "base",
  value: "value",
  minOccurs: "minOccurs",
  maxOccurs: "maxOccurs",
  use: "use",
} as const;

export type EditableField = keyof typeof FIELD_ATTRS;

let newIdCounter = 0;
export const newNodeId = (kind: string) => `${kind}-new-${(newIdCounter += 1)}`;

export interface NewNodeSpec {
  kind: XsdNodeKind;
  name?: string;
  attributes?: Record<string, string>;
}

export function createNode(spec: NewNodeSpec): XsdNode {
  const attributes: Record<string, string> = { ...(spec.attributes ?? {}) };
  if (spec.name) attributes['name'] = spec.name;
  return {
    id: newNodeId(spec.kind),
    kind: spec.kind,
    name: spec.name,
    type: attributes['type'],
    base: attributes['base'],
    value: attributes['value'],
    minOccurs: attributes['minOccurs'],
    maxOccurs: attributes['maxOccurs'],
    use: attributes['use'],
    attributes,
    line: 1,
    children: [],
    path: "",
  };
}

/** Recompute path strings after renames / structural edits. */
export function recomputePaths(node: XsdNode, parentPath = ""): XsdNode {
  const label = node.name ?? node.kind;
  const path = node.kind === "schema" ? "" : `${parentPath}/${label}`;
  node.path = path;
  node.children.forEach((c) => recomputePaths(c, path));
  return node;
}
