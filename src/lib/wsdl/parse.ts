/** Lightweight WSDL inspection: services, operations and linked schema documents. */

export interface WsdlRef {
  kind: "wsdl-import" | "xsd-import" | "xsd-include" | "xsd-redefine";
  namespace?: string | undefined;
  location?: string | undefined;
}

export interface WsdlOperation {
  name: string;
  input?: string | undefined;
  output?: string | undefined;
}

export interface ParsedWsdl {
  fileName: string;
  targetNamespace?: string | undefined;
  error?: string | undefined;
  services: {
    name: string;
    ports: { name: string; binding: string; address?: string | undefined }[];
  }[];

  portTypes: { name: string; operations: WsdlOperation[] }[];
  messages: string[];
  /** target namespaces of schemas declared inline inside <wsdl:types> */
  inlineSchemas: string[];
  refs: WsdlRef[];
}

const local = (el: Element) => el.localName || el.tagName.replace(/^.*:/, "");

function all(doc: Document | Element, name: string): Element[] {
  const root = doc instanceof Document ? doc.documentElement : doc;
  if (!root) return [];
  const out: Element[] = [];
  const walk = (el: Element) => {
    if (local(el) === name) out.push(el);
    for (const child of Array.from(el.children)) walk(child);
  };
  walk(root);
  return out;
}

export function parseWsdl(fileName: string, content: string): ParsedWsdl {
  const result: ParsedWsdl = {
    fileName,
    services: [],
    portTypes: [],
    messages: [],
    inlineSchemas: [],
    refs: [],
  };
  if (typeof DOMParser === "undefined") return result;

  const doc = new DOMParser().parseFromString(content, "application/xml");
  if (doc.querySelector("parsererror")) {
    result.error = "This WSDL is not well-formed XML.";
    return result;
  }

  result.targetNamespace = doc.documentElement?.getAttribute("targetNamespace") ?? undefined;

  result.services = all(doc, "service").map((s) => ({
    name: s.getAttribute("name") ?? "(unnamed)",
    ports: Array.from(s.children)
      .filter((p) => local(p) === "port")
      .map((p) => {
        const addr = Array.from(p.children).find((c) => local(c).includes("address"));
        return {
          name: p.getAttribute("name") ?? "(unnamed)",
          binding: (p.getAttribute("binding") ?? "").replace(/^.*:/, ""),
          address: addr?.getAttribute("location") ?? undefined,
        };
      }),
  }));

  result.portTypes = all(doc, "portType").map((pt) => ({
    name: pt.getAttribute("name") ?? "(unnamed)",
    operations: Array.from(pt.children)
      .filter((o) => local(o) === "operation")
      .map((o) => {
        const io = (kind: string) =>
          Array.from(o.children)
            .find((c) => local(c) === kind)
            ?.getAttribute("message")
            ?.replace(/^.*:/, "");
        return { name: o.getAttribute("name") ?? "(unnamed)", input: io("input"), output: io("output") };
      }),
  }));

  result.messages = all(doc, "message").map((m) => m.getAttribute("name") ?? "(unnamed)");

  for (const schema of all(doc, "schema")) {
    const tns = schema.getAttribute("targetNamespace");
    if (tns) result.inlineSchemas.push(tns);
  }

  const push = (el: Element, kind: WsdlRef["kind"], attr: string) => {
    result.refs.push({
      kind,
      namespace: el.getAttribute("namespace") ?? undefined,
      location: el.getAttribute(attr) ?? undefined,
    });
  };
  for (const el of all(doc, "import")) {
    if (el.hasAttribute("schemaLocation")) push(el, "xsd-import", "schemaLocation");
    else push(el, "wsdl-import", "location");
  }
  for (const el of all(doc, "include")) push(el, "xsd-include", "schemaLocation");
  for (const el of all(doc, "redefine")) push(el, "xsd-redefine", "schemaLocation");

  return result;
}
