import { flatten } from "./parser";
import type { DiffEntry, ParsedSchema, XsdNode } from "./types";

function keyed(schema: ParsedSchema | undefined) {
  const map = new Map<string, XsdNode>();
  flatten(schema?.root).forEach((node) => {
    if (node.kind === "schema") return;
    map.set(`${node.kind}${node.path}`, node);
  });
  return map;
}

function describe(node: XsdNode) {
  const bits = [node.kind, node.name ?? "(anonymous)"];
  if (node.type) bits.push(`: ${node.type}`);
  return bits.join(" ");
}

export function diffSchemas(left?: ParsedSchema, right?: ParsedSchema): DiffEntry[] {
  const a = keyed(left);
  const b = keyed(right);
  const keys = Array.from(new Set([...a.keys(), ...b.keys()])).sort();
  const entries: DiffEntry[] = [];

  if (left?.targetNamespace !== right?.targetNamespace) {
    entries.push({
      id: "ns",
      path: "targetNamespace",
      kind: "schema",
      status: "modified",
      left: left?.targetNamespace ?? "(none)",
      right: right?.targetNamespace ?? "(none)",
      details: ["Target namespace changed"],
    });
  }

  for (const key of keys) {
    const l = a.get(key);
    const r = b.get(key);
    if (l && !r) {
      entries.push({
        id: key,
        path: l.path,
        kind: l.kind,
        status: "removed",
        left: describe(l),
        details: ["Removed from the new schema"],
      });
      continue;
    }
    if (!l && r) {
      entries.push({
        id: key,
        path: r.path,
        kind: r.kind,
        status: "added",
        right: describe(r),
        details: ["Added in the new schema"],
      });
      continue;
    }
    if (!l || !r) continue;

    const details: string[] = [];
    const compare = (label: string, x?: string, y?: string) => {
      if ((x ?? "") !== (y ?? "")) details.push(`${label}: ${x ?? "—"} → ${y ?? "—"}`);
    };
    compare("type", l.type, r.type);
    compare("base", l.base, r.base);
    compare("minOccurs", l.minOccurs, r.minOccurs);
    compare("maxOccurs", l.maxOccurs, r.maxOccurs);
    compare("use", l.use, r.use);
    compare("value", l.value, r.value);
    if ((l.documentation ?? "") !== (r.documentation ?? "")) details.push("documentation changed");

    const attrKeys = new Set([...Object.keys(l.attributes), ...Object.keys(r.attributes)]);
    attrKeys.forEach((k) => {
      if (["name", "type", "base", "minOccurs", "maxOccurs", "use", "value"].includes(k)) return;
      if (l.attributes[k] !== r.attributes[k]) {
        details.push(`@${k}: ${l.attributes[k] ?? "—"} → ${r.attributes[k] ?? "—"}`);
      }
    });

    entries.push({
      id: key,
      path: l.path,
      kind: l.kind,
      status: details.length ? "modified" : "unchanged",
      left: describe(l),
      right: describe(r),
      details,
    });
  }

  return entries;
}

export function diffSummary(entries: DiffEntry[]) {
  return {
    added: entries.filter((e) => e.status === "added").length,
    removed: entries.filter((e) => e.status === "removed").length,
    modified: entries.filter((e) => e.status === "modified").length,
    unchanged: entries.filter((e) => e.status === "unchanged").length,
  };
}
