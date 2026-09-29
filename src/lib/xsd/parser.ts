import type {
  ParsedSchema,
  SchemaDependency,
  ValidationIssue,
  XsdNode,
  XsdNodeKind,
} from "./types";

const KIND_MAP: Record<string, XsdNodeKind> = {
  schema: "schema",
  element: "element",
  complextype: "complexType",
  simpletype: "simpleType",
  attribute: "attribute",
  attributegroup: "attributeGroup",
  group: "group",
  sequence: "sequence",
  choice: "choice",
  all: "all",
  enumeration: "enumeration",
  pattern: "pattern",
  length: "length",
  minlength: "minLength",
  maxlength: "maxLength",
  mininclusive: "minInclusive",
  maxinclusive: "maxInclusive",
  minexclusive: "minExclusive",
  maxexclusive: "maxExclusive",
  totaldigits: "totalDigits",
  fractiondigits: "fractionDigits",
  whitespace: "whiteSpace",
  restriction: "restriction",
  extension: "extension",
  documentation: "documentation",
  import: "import",
  include: "include",
};

function localName(tag: string) {
  const idx = tag.indexOf(":");
  return (idx === -1 ? tag : tag.slice(idx + 1)).toLowerCase();
}

/** Best-effort line lookup by searching the raw source for the element. */
function lineFinder(content: string) {
  const lines = content.split("\n");
  return (name: string | undefined, tag: string, fallback = 1) => {
    const needle = name ? `${tag}` : tag;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (!line.includes("<")) continue;
      if (line.includes(needle) && (!name || line.includes(`"${name}"`))) return i + 1;
    }
    return fallback;
  };
}

let counter = 0;
const uid = (prefix: string) => `${prefix}-${(counter += 1)}`;

function toNode(
  el: Element,
  parentPath: string,
  findLine: ReturnType<typeof lineFinder>,
): XsdNode {
  const tag = localName(el.tagName);
  const kind = KIND_MAP[tag] ?? "other";
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) attributes[attr.name] = attr.value;

  const name = attributes['name'] ?? attributes['ref'];
  const path = name ? `${parentPath}/${name}` : `${parentPath}/${tag}`;

  const node: XsdNode = {
    id: uid(kind),
    kind,
    tag: el.tagName,
    name,
    type: attributes['type'],
    base: attributes['base'],
    value: attributes['value'],
    minOccurs: attributes['minOccurs'],
    maxOccurs: attributes['maxOccurs'],
    use: attributes['use'],
    attributes,
    line: findLine(name, `<${el.tagName}`),
    children: [],
    path,
  };

  for (const child of Array.from(el.children)) {
    const childTag = localName(child.tagName);
    if (childTag === "annotation") {
      const doc = child.textContent?.trim();
      if (doc) node.documentation = doc;
      continue;
    }
    if (childTag === "documentation") {
      node.documentation = child.textContent?.trim();
      continue;
    }
    node.children.push(toNode(child, path, findLine));
  }

  return node;
}

function countKinds(node: XsdNode, acc: ParsedSchema["stats"]) {
  if (node.kind === "element" && node.name) acc.elements += 1;
  if (node.kind === "complexType") acc.complexTypes += 1;
  if (node.kind === "simpleType") acc.simpleTypes += 1;
  if (node.kind === "attribute") acc.attributes += 1;
  if (node.kind === "enumeration") acc.enumerations += 1;
  node.children.forEach((c) => countKinds(c, acc));
}

function syntaxChecks(content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    if (/<xs?d?:?element\b/i.test(line) && !/name=|ref=/.test(line)) {
      issues.push({
        id: uid("val"),
        severity: "error",
        message: "Element declaration is missing a name or ref attribute.",
        line: i + 1,
      });
    }
    if (/maxOccurs="0"/.test(line)) {
      issues.push({
        id: uid("val"),
        severity: "warning",
        message: "maxOccurs=\"0\" makes this particle unusable.",
        line: i + 1,
      });
    }
  });
  return issues;
}

export function parseXsd(fileName: string, content: string): ParsedSchema {
  const size = new Blob([content]).size;
  const findLine = lineFinder(content);
  const schema: ParsedSchema = {
    id: uid("schema"),
    fileName,
    size,
    content,
    dependencies: [],
    errors: [],
    stats: {
      elements: 0,
      complexTypes: 0,
      simpleTypes: 0,
      attributes: 0,
      enumerations: 0,
    },
    uploadedAt: Date.now(),
  };

  if (typeof DOMParser === "undefined") return schema;

  const doc = new DOMParser().parseFromString(content, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    const text = parseError.textContent ?? "Malformed XML document.";
    const lineMatch = text.match(/line[: ]+(\d+)/i);
    schema.errors.push({
      id: uid("val"),
      severity: "error",
      message: "XML syntax error — the schema could not be parsed.",
      detail: text.replace(/\s+/g, " ").slice(0, 400),
      line: lineMatch ? Number(lineMatch[1]) : 1,
    });
    return schema;
  }

  const rootEl = doc.documentElement;
  if (!rootEl || localName(rootEl.tagName) !== "schema") {
    schema.errors.push({
      id: uid("val"),
      severity: "error",
      message: "Root element is not xs:schema — this file is not an XSD.",
      line: 1,
    });
    return schema;
  }

  schema.prefix = rootEl.tagName.includes(":") ? rootEl.tagName.split(":")[0] : undefined;
  schema.targetNamespace = rootEl.getAttribute("targetNamespace") ?? undefined;
  schema.elementFormDefault = rootEl.getAttribute("elementFormDefault") ?? undefined;
  schema.root = toNode(rootEl, "", findLine);

  const deps: SchemaDependency[] = [];
  for (const child of schema.root.children) {
    if (child.kind === "import" || child.kind === "include") {
      deps.push({
        kind: child.kind,
        namespace: child.attributes['namespace'],
        location: child.attributes['schemaLocation'],
      });
    }
  }
  schema.dependencies = deps;
  countKinds(schema.root, schema.stats);
  schema.errors.push(...syntaxChecks(content));
  return schema;
}

export function flatten(node: XsdNode | undefined, out: XsdNode[] = []): XsdNode[] {
  if (!node) return out;
  out.push(node);
  node.children.forEach((c) => flatten(c, out));
  return out;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
