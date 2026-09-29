export interface XmlNode {
  id: string;
  kind: "element" | "text" | "comment" | "cdata" | "processing";
  name: string;
  value?: string | undefined;
  attributes: { name: string; value: string }[];
  children: XmlNode[];
  path: string;
  depth: number;
}

export interface ParsedXml {
  fileName: string;
  content: string;
  size: number;
  root?: XmlNode | undefined;
  error?: string | undefined;
  stats: { elements: number; attributes: number; maxDepth: number };
}

let counter = 0;
const uid = () => `x-${(counter += 1)}`;

function build(node: Node, parentPath: string, depth: number): XmlNode | undefined {
  if (node.nodeType === 3) {
    const text = node.nodeValue?.trim();
    if (!text) return undefined;
    return {
      id: uid(),
      kind: "text",
      name: "#text",
      value: text,
      attributes: [],
      children: [],
      path: `${parentPath}/#text`,
      depth,
    };
  }
  if (node.nodeType === 4) {
    return {
      id: uid(),
      kind: "cdata",
      name: "#cdata",
      value: node.nodeValue ?? "",
      attributes: [],
      children: [],
      path: `${parentPath}/#cdata`,
      depth,
    };
  }
  if (node.nodeType === 8) {
    const text = node.nodeValue?.trim();
    if (!text) return undefined;
    return {
      id: uid(),
      kind: "comment",
      name: "#comment",
      value: text,
      attributes: [],
      children: [],
      path: `${parentPath}/#comment`,
      depth,
    };
  }
  if (node.nodeType === 7) {
    return {
      id: uid(),
      kind: "processing",
      name: (node as ProcessingInstruction).target,
      value: node.nodeValue ?? "",
      attributes: [],
      children: [],
      path: `${parentPath}/?`,
      depth,
    };
  }
  if (node.nodeType !== 1) return undefined;

  const el = node as Element;
  const path = `${parentPath}/${el.tagName}`;
  const children: XmlNode[] = [];
  for (const child of Array.from(el.childNodes)) {
    const built = build(child, path, depth + 1);
    if (built) children.push(built);
  }
  return {
    id: uid(),
    kind: "element",
    name: el.tagName,
    attributes: Array.from(el.attributes).map((a) => ({ name: a.name, value: a.value })),
    children,
    path,
    depth,
  };
}

function walk(node: XmlNode, stats: ParsedXml["stats"]) {
  if (node.kind === "element") stats.elements += 1;
  stats.attributes += node.attributes.length;
  stats.maxDepth = Math.max(stats.maxDepth, node.depth + 1);
  node.children.forEach((c) => walk(c, stats));
}

export function parseXml(fileName: string, content: string): ParsedXml {
  const result: ParsedXml = {
    fileName,
    content,
    size: new Blob([content]).size,
    stats: { elements: 0, attributes: 0, maxDepth: 0 },
  };

  if (typeof DOMParser === "undefined") return result;

  const doc = new DOMParser().parseFromString(content, "application/xml");
  const err = doc.querySelector("parsererror");
  if (err) {
    result.error = (err.textContent ?? "Malformed XML document.").replace(/\s+/g, " ").slice(0, 400);
    return result;
  }
  const root = doc.documentElement ? build(doc.documentElement, "", 0) : undefined;
  result.root = root;
  if (root) walk(root, result.stats);
  return result;
}

/** Text value of an element that has only a single text child (XMLSpy grid style). */
export function inlineValue(node: XmlNode): string | undefined {
  if (node.kind !== "element") return node.value;
  if (node.children.length === 1 && node.children[0]?.kind === "text") {
    return node.children[0].value;
  }
  return undefined;
}

export function nodeMatches(node: XmlNode, q: string): boolean {
  if (!q) return true;
  const hay = `${node.name} ${node.value ?? ""} ${node.attributes
    .map((a) => `${a.name}=${a.value}`)
    .join(" ")}`.toLowerCase();
  return hay.includes(q) || node.children.some((c) => nodeMatches(c, q));
}

export const SAMPLE_XML = {
  fileName: "purchase-order-demo.xml",
  content: `<?xml version="1.0" encoding="UTF-8"?>
<!-- Synthetic demo document - no real data -->
<PurchaseOrder orderId="PO-2026-000142" currency="EUR" xmlns="urn:demo:orders:v1">
  <Customer id="CUST-9001" segment="retail">
    <Name>Fictional Falcon B.V.</Name>
    <Email>orders@example-falcon.test</Email>
    <Address country="NL">
      <Street>Imaginary Street 42</Street>
      <City>Sampleton</City>
      <PostalCode>1234 AB</PostalCode>
    </Address>
  </Customer>
  <Lines>
    <Line sku="SKU-001" quantity="2">
      <Description>Demo widget, blue</Description>
      <UnitPrice>19.95</UnitPrice>
    </Line>
    <Line sku="SKU-114" quantity="1">
      <Description>Demo widget, large</Description>
      <UnitPrice>149.00</UnitPrice>
    </Line>
  </Lines>
  <Totals>
    <Net>188.90</Net>
    <Vat rate="0.21">39.67</Vat>
    <Gross>228.57</Gross>
  </Totals>
  <Notes><![CDATA[Mock order generated for demonstration purposes only.]]></Notes>
</PurchaseOrder>
`,
};
