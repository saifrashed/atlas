/**
 * Synthetic XML instance generator.
 * Produces obviously fictional demo data from a parsed XSD — never real data.
 */
import type { ParsedSchema, XsdNode } from "./types";

export interface GenerateOptions {
  /** Number of repetitions produced for unbounded / multi-occurrence elements. */
  repeat: number;
  /** Include elements/attributes marked optional. */
  includeOptional: boolean;
  /** Maximum nesting depth before recursion is cut off. */
  maxDepth: number;
  /** Seed so the same schema yields the same demo document. */
  seed: number;
}

export const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  repeat: 2,
  includeOptional: true,
  maxDepth: 12,
  seed: 42,
};

const FIRST_NAMES = ["Anika", "Bram", "Chiara", "Diederik", "Eva", "Femke", "Joris", "Noor"];
const LAST_NAMES = ["Demova", "Voorbeeld", "Fictief", "Testerman", "Mockford", "Sample"];
const CITIES = ["Demostad", "Mockdam", "Voorbeeldburg", "Testhoven", "Fictieveen"];
const STREETS = ["Voorbeeldstraat", "Demolaan", "Mockweg", "Testkade"];
const COMPANIES = ["Demo Holding BV", "Mockwerk NV", "Voorbeeld Retail BV", "Fictief Logistics BV"];
const WORDS = [
  "demo",
  "sample",
  "mock",
  "synthetic",
  "example",
  "fictional",
  "placeholder",
  "prototype",
];

function makeRandom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
}

type Rand = () => number;
const pick = <T,>(rand: Rand, list: T[]): T => list[Math.floor(rand() * list.length) % list.length]!;
const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const local = (value?: string) => (value ? value.split(":").pop() ?? value : "");

function pad(n: number, size = 2) {
  return String(n).padStart(size, "0");
}

function fakeDate(rand: Rand) {
  return `2026-${pad(int(rand, 1, 12))}-${pad(int(rand, 1, 28))}`;
}

function fakeTime(rand: Rand) {
  return `${pad(int(rand, 0, 23))}:${pad(int(rand, 0, 59))}:${pad(int(rand, 0, 59))}`;
}

/** Heuristic fake value based on the element/attribute name. */
function byName(rand: Rand, name: string): string | undefined {
  const n = name.toLowerCase();
  if (/(^|[^a-z])iban/.test(n)) return `NL${pad(int(rand, 10, 99))}DEMO0${int(rand, 100000000, 999999999)}`;
  if (n.includes("bic")) return "DEMONL2AXXX";
  if (n.includes("email") || n.includes("mail")) {
    return `${pick(rand, FIRST_NAMES).toLowerCase()}.${pick(rand, LAST_NAMES).toLowerCase()}@example.invalid`;
  }
  if (n.includes("phone") || n.includes("tel")) return `+31 6 0000 ${pad(int(rand, 1000, 9999), 4)}`;
  if (n.includes("firstname") || n.includes("givenname")) return pick(rand, FIRST_NAMES);
  if (n.includes("lastname") || n.includes("surname")) return pick(rand, LAST_NAMES);
  if (n.includes("company") || n.includes("organisation") || n.includes("organization")) {
    return pick(rand, COMPANIES);
  }
  if (n.endsWith("name") || n.includes("displayname")) {
    return `${pick(rand, FIRST_NAMES)} ${pick(rand, LAST_NAMES)}`;
  }
  if (n.includes("street") || n.includes("address")) {
    return `${pick(rand, STREETS)} ${int(rand, 1, 199)}`;
  }
  if (n.includes("city")) return pick(rand, CITIES);
  if (n.includes("postal") || n.includes("zip")) return `${int(rand, 1000, 9999)} ZZ`;
  if (n.includes("country")) return "NL";
  if (n.includes("currency")) return "EUR";
  if (n.includes("amount") || n.includes("price") || n.includes("total")) {
    return `${int(rand, 1, 9999)}.${pad(int(rand, 0, 99))}`;
  }
  if (n.includes("quantity") || n.includes("count")) return String(int(rand, 1, 25));
  if (n.endsWith("id") || n.includes("identifier") || n.includes("reference")) {
    return `DEMO-${int(rand, 10000, 99999)}`;
  }
  if (n.includes("date") || n.includes("day")) return fakeDate(rand);
  if (n.includes("time")) return `${fakeDate(rand)}T${fakeTime(rand)}`;
  if (n.includes("description") || n.includes("comment") || n.includes("note")) {
    return `Synthetic ${pick(rand, WORDS)} text for demo purposes`;
  }
  if (n.includes("url") || n.includes("uri") || n.includes("link")) {
    return "https://example.invalid/demo";
  }
  return undefined;
}

/** Fake value for an XML Schema built-in type. */
function byType(rand: Rand, type: string, name: string): string {
  const t = local(type).toLowerCase();
  switch (t) {
    case "boolean":
      return rand() > 0.5 ? "true" : "false";
    case "int":
    case "integer":
    case "long":
    case "short":
    case "positiveinteger":
    case "nonnegativeinteger":
    case "unsignedint":
    case "unsignedlong":
      return /quantity|count|amount|items/i.test(name)
        ? String(int(rand, 1, 25))
        : String(int(rand, 1, 9999));
    case "negativeinteger":
    case "nonpositiveinteger":
      return String(-int(rand, 1, 999));
    case "decimal":
    case "double":
    case "float":
      return `${int(rand, 1, 9999)}.${pad(int(rand, 0, 99))}`;
    case "date":
      return fakeDate(rand);
    case "time":
      return fakeTime(rand);
    case "datetime":
      return `${fakeDate(rand)}T${fakeTime(rand)}`;
    case "gyear":
      return "2026";
    case "duration":
      return "P1D";
    case "base64binary":
      return "REVNTw==";
    case "hexbinary":
      return "44454D4F";
    case "anyuri":
      return "https://example.invalid/demo";
    case "language":
      return "nl";
    default:
      return byName(rand, name) ?? `${pick(rand, WORDS)}-${int(rand, 100, 999)}`;
  }
}

interface Ctx {
  rand: Rand;
  opts: GenerateOptions;
  complex: Map<string, XsdNode>;
  simple: Map<string, XsdNode>;
  elements: Map<string, XsdNode>;
  prefix: string;
  lines: string[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function indexSchema(schema: ParsedSchema) {
  const complex = new Map<string, XsdNode>();
  const simple = new Map<string, XsdNode>();
  const elements = new Map<string, XsdNode>();
  (schema.root?.children ?? []).forEach((n) => {
    if (!n.name) return;
    if (n.kind === "complexType") complex.set(n.name, n);
    else if (n.kind === "simpleType") simple.set(n.name, n);
    else if (n.kind === "element") elements.set(n.name, n);
  });
  return { complex, simple, elements };
}

/** All root-level elements that can serve as a document root. */
export function rootElements(schema?: ParsedSchema): XsdNode[] {
  return (schema?.root?.children ?? []).filter((n) => n.kind === "element" && n.name);
}

function enumValues(node: XsdNode | undefined, ctx: Ctx, depth = 0): string[] {
  if (!node || depth > 4) return [];
  const direct = node.children.filter((c) => c.kind === "enumeration").map((c) => c.value ?? "");
  if (direct.length) return direct.filter(Boolean);
  for (const child of node.children) {
    if (child.kind === "restriction" || child.kind === "simpleType") {
      const found = enumValues(child, ctx, depth + 1);
      if (found.length) return found;
      if (child.base) {
        const base = ctx.simple.get(local(child.base));
        if (base) {
          const viaBase = enumValues(base, ctx, depth + 1);
          if (viaBase.length) return viaBase;
        }
      }
    }
  }
  return [];
}

function resolveComplex(node: XsdNode, ctx: Ctx): XsdNode | undefined {
  const inline = node.children.find((c) => c.kind === "complexType");
  if (inline) return inline;
  if (node.type) return ctx.complex.get(local(node.type));
  return undefined;
}

function contentChildren(node: XsdNode): XsdNode[] {
  const out: XsdNode[] = [];
  const walk = (n: XsdNode) => {
    n.children.forEach((c) => {
      if (c.kind === "sequence" || c.kind === "all") walk(c);
      else if (c.kind === "choice") {
        const first = c.children.find((x) => x.kind === "element") ?? c.children[0];
        if (first) {
          if (first.kind === "element") out.push(first);
          else walk(c);
        }
      } else if (c.kind === "extension" || c.kind === "restriction" || c.kind === "group") walk(c);
      else if (c.kind === "element") out.push(c);
    });
  };
  walk(node);
  return out;
}

function attributesOf(node: XsdNode): XsdNode[] {
  const out: XsdNode[] = [];
  const walk = (n: XsdNode) => {
    n.children.forEach((c) => {
      if (c.kind === "attribute") out.push(c);
      else if (c.kind === "extension" || c.kind === "restriction" || c.kind === "attributeGroup")
        walk(c);
    });
  };
  walk(node);
  return out;
}

function simpleValue(node: XsdNode, ctx: Ctx): string {
  const name = node.name ?? "value";
  const enums = enumValues(node, ctx);
  if (enums.length) return pick(ctx.rand, enums);
  const typeName = local(node.type);
  if (typeName) {
    const st = ctx.simple.get(typeName);
    if (st) {
      const stEnums = enumValues(st, ctx);
      if (stEnums.length) return pick(ctx.rand, stEnums);
      const base = st.children.find((c) => c.kind === "restriction")?.base;
      return byType(ctx.rand, base ?? "string", name);
    }
  }
  return byType(ctx.rand, node.type ?? "string", name);
}

function occurrences(node: XsdNode, ctx: Ctx): number {
  const min = Number(node.minOccurs ?? "1");
  const max = node.maxOccurs === "unbounded" ? Infinity : Number(node.maxOccurs ?? "1");
  if (min === 0 && !ctx.opts.includeOptional) return 0;
  const wanted = Math.max(min || 0, 1);
  return Math.max(1, Math.min(max === Infinity ? ctx.opts.repeat : max, Math.max(wanted, ctx.opts.repeat > 1 && max > 1 ? ctx.opts.repeat : wanted)));
}

function emitElement(node: XsdNode, ctx: Ctx, depth: number, indent: string, extra = "") {
  const name = node.name ?? local(node.attributes["ref"]) ?? "element";
  const tag = ctx.prefix ? `${ctx.prefix}:${name}` : name;
  const complex = resolveComplex(node, ctx);

  const attrs = complex
    ? attributesOf(complex)
        .filter((a) => ctx.opts.includeOptional || a.use === "required")
        .map((a) => ` ${a.name ?? "attr"}="${esc(simpleValue(a, ctx))}"`)
        .join("")
    : "";

  if (!complex || depth >= ctx.opts.maxDepth) {
    const value = complex ? "" : esc(simpleValue(node, ctx));
    if (!value && complex) {
      ctx.lines.push(`${indent}<${tag}${extra}${attrs}/>`);
    } else {
      ctx.lines.push(`${indent}<${tag}${extra}${attrs}>${value}</${tag}>`);
    }
    return;
  }

  const children = contentChildren(complex);
  if (!children.length) {
    const text = complex.children.some((c) => c.kind === "extension" || c.kind === "restriction")
      ? esc(byName(ctx.rand, name) ?? `${pick(ctx.rand, WORDS)} value`)
      : "";
    ctx.lines.push(
      text
        ? `${indent}<${tag}${extra}${attrs}>${text}</${tag}>`
        : `${indent}<${tag}${extra}${attrs}/>`,
    );
    return;
  }

  ctx.lines.push(`${indent}<${tag}${extra}${attrs}>`);
  children.forEach((child) => {
    const refName = local(child.attributes["ref"]);
    const target = child.name ? child : ctx.elements.get(refName) ?? child;
    const times = occurrences(child, ctx);
    for (let i = 0; i < times; i++) emitElement(target, ctx, depth + 1, indent + "  ");
  });
  ctx.lines.push(`${indent}</${tag}>`);
}

/** Build a synthetic XML instance document for one root element of a schema. */
export function generateXmlInstance(
  schema: ParsedSchema,
  rootName: string,
  options: Partial<GenerateOptions> = {},
): string {
  const opts = { ...DEFAULT_GENERATE_OPTIONS, ...options };
  const maps = indexSchema(schema);
  const root = maps.elements.get(rootName) ?? rootElements(schema)[0];
  if (!root) return "<!-- No global element found in this schema -->";

  const ns = schema.targetNamespace;
  const prefix = ns ? "tns" : "";
  const ctx: Ctx = { rand: makeRandom(opts.seed), opts, ...maps, prefix, lines: [] };

  const nsAttr = ns ? ` xmlns:tns="${esc(ns)}"` : "";
  emitElement(root, ctx, 0, "", nsAttr);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!-- Synthetic demo data generated from ${schema.fileName} — fictional values only -->`,
    ...ctx.lines,
    "",
  ].join("\n");
}

/** Wrap a generated payload in a SOAP 1.1 envelope for a WSDL operation demo. */
export function wrapSoapEnvelope(payload: string, soapAction?: string): string {
  const body = payload
    .split("\n")
    .filter((l) => !l.startsWith("<?xml") && l.trim() !== "")
    .map((l) => `    ${l}`)
    .join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    soapAction ? `<!-- SOAPAction: ${soapAction} (synthetic demo request) -->` : "",
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">`,
    `  <soapenv:Header/>`,
    `  <soapenv:Body>`,
    body,
    `  </soapenv:Body>`,
    `</soapenv:Envelope>`,
    "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
