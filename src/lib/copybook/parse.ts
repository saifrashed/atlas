/**
 * Minimal COBOL copybook parser -> XSD / sample XML.
 * Hackathon prototype: handles level numbers, PIC clauses, OCCURS and REDEFINES
 * well enough for demo copybooks. Synthetic data only.
 */

export interface CopybookField {
  level: number;
  name: string;
  pic?: string;
  occurs?: number;
  redefines?: string;
  children: CopybookField[];
}

export interface CopybookParseResult {
  roots: CopybookField[];
  warnings: string[];
}

function xmlName(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const parts = cleaned.split("-").filter(Boolean);
  if (!parts.length) return "Field";
  const name = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("");
  return /^[A-Za-z_]/.test(name) ? name : `F${name}`;
}

export function parseCopybook(source: string): CopybookParseResult {
  const warnings: string[] = [];
  // Strip sequence area (cols 1-6) and comment lines, then join continuation by ".".
  const logical: string[] = [];
  let buffer = "";
  for (const rawLine of source.split(/\r?\n/)) {
    let line = rawLine;
    if (/^.{6}[*/]/.test(line)) continue; // comment indicator in col 7
    if (line.length > 6 && /^[0-9 ]{6}/.test(line)) line = line.slice(6);
    if (line.trimStart().startsWith("*")) continue;
    if (!line.trim()) continue;
    buffer += ` ${line.trim()}`;
    while (buffer.includes(".")) {
      const idx = buffer.indexOf(".");
      const stmt = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (stmt) logical.push(stmt);
    }
  }
  if (buffer.trim()) logical.push(buffer.trim());

  const roots: CopybookField[] = [];
  const stack: CopybookField[] = [];

  for (const stmt of logical) {
    const m = /^(\d{2})\s+([A-Za-z0-9-]+)(.*)$/.exec(stmt);
    if (!m) {
      warnings.push(`Skipped line: ${stmt.slice(0, 60)}`);
      continue;
    }
    const level = Number(m[1]);
    const name = m[2]!;
    const rest = m[3] ?? "";
    if (level === 88) continue; // condition names have no structure

    const pic = /\bPIC(?:TURE)?\s+(?:IS\s+)?([^\s.]+)/i.exec(rest)?.[1];
    const occursRaw = /\bOCCURS\s+(\d+)/i.exec(rest)?.[1];
    const redefines = /\bREDEFINES\s+([A-Za-z0-9-]+)/i.exec(rest)?.[1];

    const field: CopybookField = {
      level,
      name,
      children: [],
      ...(pic ? { pic } : {}),
      ...(occursRaw ? { occurs: Number(occursRaw) } : {}),
      ...(redefines ? { redefines } : {}),
    };

    while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
    if (!stack.length) roots.push(field);
    else stack[stack.length - 1]!.children.push(field);
    stack.push(field);
  }

  if (!roots.length) warnings.push("No copybook fields recognised.");
  return { roots, warnings };
}

interface PicInfo {
  type: string;
  maxLength?: number;
  fractionDigits?: number;
  totalDigits?: number;
}

export function picToType(pic: string): PicInfo {
  const p = pic.toUpperCase();
  const expand = (src: string) => {
    let out = "";
    const re = /([A9XSVZ])(?:\((\d+)\))?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      out += (m[1] ?? "").repeat(m[2] ? Number(m[2]) : 1);
    }
    return out;
  };
  const expanded = expand(p);
  if (/[X A]/.test(expanded.replace(/9|S|V|Z/g, "")) || /^[XA]+$/.test(expanded)) {
    return { type: "xs:string", maxLength: expanded.length || 1 };
  }
  if (/9/.test(expanded)) {
    const [intPart, fracPart] = expanded.split("V");
    const total = (intPart ?? "").replace(/[^9Z]/g, "").length + (fracPart ?? "").length;
    if (fracPart && fracPart.length) {
      return { type: "xs:decimal", totalDigits: total, fractionDigits: fracPart.length };
    }
    return { type: "xs:integer", totalDigits: total };
  }
  return { type: "xs:string", maxLength: expanded.length || 1 };
}

function fieldToXsd(field: CopybookField, indent: string): string {
  const name = xmlName(field.name);
  const occ = field.occurs ? ` minOccurs="0" maxOccurs="${field.occurs}"` : "";
  const comment = field.redefines ? ` <!-- REDEFINES ${field.redefines} -->` : "";

  if (field.children.length) {
    const inner = field.children.map((c) => fieldToXsd(c, `${indent}      `)).join("\n");
    return `${indent}<xs:element name="${name}"${occ}>${comment}
${indent}  <xs:complexType>
${indent}    <xs:sequence>
${inner}
${indent}    </xs:sequence>
${indent}  </xs:complexType>
${indent}</xs:element>`;
  }

  const info = field.pic ? picToType(field.pic) : { type: "xs:string" as const };
  const facets: string[] = [];
  if (info.maxLength) facets.push(`${indent}      <xs:maxLength value="${info.maxLength}"/>`);
  if (info.totalDigits) facets.push(`${indent}      <xs:totalDigits value="${info.totalDigits}"/>`);
  if (info.fractionDigits !== undefined)
    facets.push(`${indent}      <xs:fractionDigits value="${info.fractionDigits}"/>`);

  if (!facets.length) return `${indent}<xs:element name="${name}" type="${info.type}"${occ}/>${comment}`;

  return `${indent}<xs:element name="${name}"${occ}>${comment}
${indent}  <xs:simpleType>
${indent}    <xs:restriction base="${info.type}">
${facets.join("\n")}
${indent}    </xs:restriction>
${indent}  </xs:simpleType>
${indent}</xs:element>`;
}

export function copybookToXsd(
  roots: CopybookField[],
  opts?: { targetNamespace?: string; rootName?: string },
): string {
  const ns = opts?.targetNamespace ?? "http://demo.local/copybook";
  const body =
    roots.length === 1
      ? fieldToXsd(roots[0]!, "  ")
      : `  <xs:element name="${xmlName(opts?.rootName ?? "CopybookRecord")}">
    <xs:complexType>
      <xs:sequence>
${roots.map((r) => fieldToXsd(r, "        ")).join("\n")}
      </xs:sequence>
    </xs:complexType>
  </xs:element>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated from a COBOL copybook by XSD Studio (prototype, synthetic demo data). -->
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           xmlns:tns="${ns}"
           targetNamespace="${ns}"
           elementFormDefault="qualified">
${body}
</xs:schema>
`;
}

function sampleValue(field: CopybookField, index: number): string {
  if (!field.pic) return "";
  const info = picToType(field.pic);
  if (info.type === "xs:integer") return String(100 + index);
  if (info.type === "xs:decimal") return (100 + index + 0.25).toFixed(info.fractionDigits ?? 2);
  const base = `DEMO-${xmlName(field.name).toUpperCase()}`;
  return info.maxLength ? base.slice(0, info.maxLength) : base;
}

function fieldToXml(field: CopybookField, indent: string, index: number): string {
  const name = xmlName(field.name);
  const times = field.occurs ? Math.min(field.occurs, 2) : 1;
  const one = (i: number): string => {
    if (field.children.length) {
      const inner = field.children.map((c, ci) => fieldToXml(c, `${indent}  `, ci + i)).join("\n");
      return `${indent}<${name}>\n${inner}\n${indent}</${name}>`;
    }
    return `${indent}<${name}>${sampleValue(field, index + i)}</${name}>`;
  };
  return Array.from({ length: times }, (_, i) => one(i)).join("\n");
}

function jsonKey(raw: string) {
  const n = xmlName(raw);
  return n.charAt(0).toLowerCase() + n.slice(1);
}

function fieldToJsonValue(field: CopybookField, index: number): unknown {
  const one = (i: number): unknown => {
    if (field.children.length) {
      const obj: Record<string, unknown> = {};
      field.children.forEach((c, ci) => {
        obj[jsonKey(c.name)] = fieldToJsonValue(c, index + i + ci);
      });
      return obj;
    }
    const info = field.pic ? picToType(field.pic) : { type: "xs:string" as const };
    const raw = sampleValue(field, index + i);
    if (info.type === "xs:integer") return Number(raw);
    if (info.type === "xs:decimal") return Number(raw);
    return raw;
  };
  if (field.occurs) return Array.from({ length: Math.min(field.occurs, 2) }, (_, i) => one(i));
  return one(0);
}

/** Synthetic demo JSON generated from a copybook structure. */
export function copybookToJson(roots: CopybookField[], rootName = "copybookRecord"): string {
  const obj: Record<string, unknown> =
    roots.length === 1
      ? { [jsonKey(roots[0]!.name)]: fieldToJsonValue(roots[0]!, 0) }
      : { [jsonKey(rootName)]: Object.fromEntries(roots.map((r, i) => [jsonKey(r.name), fieldToJsonValue(r, i)])) };
  return `${JSON.stringify(obj, null, 2)}\n`;
}

export function copybookToXml(roots: CopybookField[], rootName = "CopybookRecord"): string {
  const body =
    roots.length === 1
      ? fieldToXml(roots[0]!, "  ", 0)
      : roots.map((r, i) => fieldToXml(r, "  ", i)).join("\n");
  const wrapper = roots.length === 1 ? undefined : xmlName(rootName);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Synthetic demo data generated from a COBOL copybook. Not real records. -->
${wrapper ? `<${wrapper}>\n${body}\n</${wrapper}>` : body}
`;
}
