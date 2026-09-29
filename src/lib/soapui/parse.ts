/**
 * Minimal SoapUI project reader (prototype).
 * Extracts interfaces, operations, request payloads and embedded XSD/WSDL parts
 * from a *-soapui-project.xml file so the payloads can be used as test data.
 */

export interface SoapUiRequest {
  id: string;
  name: string;
  interfaceName: string;
  operation: string;
  content: string;
}

export interface SoapUiSchema {
  id: string;
  fileName: string;
  content: string;
}

export interface ParsedSoapUiProject {
  projectName: string;
  requests: SoapUiRequest[];
  schemas: SoapUiSchema[];
  errors: string[];
}

const local = (el: Element) => el.localName || el.nodeName.replace(/^.*:/, "");

function byLocalName(root: Element | Document, name: string): Element[] {
  const out: Element[] = [];
  const walk = (node: Element) => {
    if (local(node) === name) out.push(node);
    for (const child of Array.from(node.children)) walk(child);
  };
  const start = root instanceof Document ? root.documentElement : root;
  if (start) walk(start);
  return out;
}

function ancestorName(el: Element, tag: string): string {
  let cur: Element | null = el.parentElement;
  while (cur) {
    if (local(cur) === tag) return cur.getAttribute("name") ?? "";
    cur = cur.parentElement;
  }
  return "";
}

export function parseSoapUiProject(source: string, fileName = "soapui-project.xml"): ParsedSoapUiProject {
  const errors: string[] = [];
  const doc = new DOMParser().parseFromString(source, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    return {
      projectName: fileName,
      requests: [],
      schemas: [],
      errors: ["The SoapUI project file could not be parsed as XML."],
    };
  }

  const rootEl = doc.documentElement;
  if (!rootEl || !/soapui-project/i.test(local(rootEl))) {
    errors.push("This does not look like a SoapUI project file (expected <con:soapui-project>).");
  }
  const projectName = rootEl?.getAttribute("name") ?? fileName;

  const requests: SoapUiRequest[] = [];
  let index = 0;
  for (const req of byLocalName(doc, "request")) {
    const content = byLocalName(req, "request")
      .filter((c) => c !== req)
      .map((c) => c.textContent ?? "")
      .find((c) => c.trim().length > 0);
    const body = (content ?? req.textContent ?? "").trim();
    if (!body.startsWith("<")) continue;
    const name = req.getAttribute("name") ?? `Request ${index + 1}`;
    requests.push({
      id: `${fileName}::${index++}`,
      name,
      interfaceName: ancestorName(req, "interface"),
      operation: ancestorName(req, "operation"),
      content: body,
    });
  }

  // Test-step requests keep their payload in <con:request> inside <con:config>.
  for (const step of byLocalName(doc, "testStep")) {
    const payload = byLocalName(step, "request")
      .map((c) => (c.textContent ?? "").trim())
      .find((c) => c.startsWith("<"));
    if (!payload) continue;
    const name = step.getAttribute("name") ?? `Test step ${index + 1}`;
    if (requests.some((r) => r.content === payload)) continue;
    requests.push({
      id: `${fileName}::step::${index++}`,
      name,
      interfaceName: ancestorName(step, "testSuite"),
      operation: ancestorName(step, "testCase"),
      content: payload,
    });
  }

  const schemas: SoapUiSchema[] = [];
  let partIndex = 0;
  for (const part of byLocalName(doc, "part")) {
    const url = byLocalName(part, "url")[0]?.textContent?.trim() ?? "";
    const content = byLocalName(part, "content")[0]?.textContent?.trim() ?? "";
    if (!content.startsWith("<")) continue;
    const isSchema = /<(?:\w+:)?schema[\s>]/.test(content);
    const isWsdl = /<(?:\w+:)?definitions[\s>]/.test(content);
    if (!isSchema && !isWsdl) continue;
    const base = url.split(/[\\/?]/).filter(Boolean).pop() ?? `${projectName}-part-${partIndex}`;
    const ext = isSchema ? ".xsd" : ".wsdl";
    const fName = /\.(xsd|wsdl)$/i.test(base) ? base : `${base}${ext}`;
    schemas.push({ id: `${fileName}::part::${partIndex++}`, fileName: fName, content });
  }

  if (!requests.length && !schemas.length) {
    errors.push("No requests or embedded schemas found in this project file.");
  }

  return { projectName, requests, schemas, errors };
}
