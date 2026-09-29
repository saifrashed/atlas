import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { FileDown, FileText, Printer } from "lucide-react";
import { AppShell } from "@/components/studio/AppShell";
import { SchemaList } from "@/components/studio/SchemaList";
import { Button } from "@/components/ui/button";
import { useStudio, type Comment } from "@/lib/store";
import { flatten } from "@/lib/xsd/parser";
import type { ParsedSchema, XsdNode } from "@/lib/xsd/types";

export const Route = createFileRoute("/documentation")({
  head: () => ({
    meta: [
      { title: "Documentation Generator — XSD Studio" },
      {
        name: "description",
        content:
          "Auto-generate schema documentation from XSD files and export it as Markdown, HTML or PDF.",
      },
      { property: "og:title", content: "Documentation Generator — XSD Studio" },
      {
        property: "og:description",
        content: "Generate readable documentation for every element, type and enumeration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DocumentationPage,
});

function documented(schema?: ParsedSchema) {
  return flatten(schema?.root).filter(
    (n) => n.name && ["element", "complexType", "simpleType", "attribute"].includes(n.kind),
  );
}

function commentsFor(node: XsdNode, comments: Comment[]) {
  return comments.filter((comment) => comment.target === node.path);
}

function toMarkdown(schema: ParsedSchema, nodes: XsdNode[], comments: Comment[]) {
  const out = [
    `# ${schema.fileName}`,
    ``,
    `- Target namespace: \`${schema.targetNamespace ?? "none"}\``,
    `- Elements: ${schema.stats.elements} · Complex types: ${schema.stats.complexTypes} · Simple types: ${schema.stats.simpleTypes}`,
    ``,
    `## Components`,
    ``,
  ];
  nodes.forEach((n) => {
    out.push(`### ${n.name} (${n.kind})`);
    if (n.type) out.push(`- Type: \`${n.type}\``);
    if (n.base) out.push(`- Base: \`${n.base}\``);
    out.push(`- Occurrence: ${n.minOccurs ?? "1"}..${n.maxOccurs ?? "1"}`);
    const enums = n.children.filter((c) => c.kind === "enumeration");
    if (enums.length) out.push(`- Values: ${enums.map((e) => `\`${e.value}\``).join(", ")}`);
    out.push(``, n.documentation ?? "_No documentation provided._", ``);
    const reviews = commentsFor(n, comments);
    if (reviews.length) {
      out.push(`#### Review comments`, ``);
      reviews.forEach((comment) => out.push(`- **${comment.author}:** ${comment.body}`));
      out.push(``);
    }
  });
  return out.join("\n");
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function DocumentationPage() {
  const schemas = useStudio((s) => s.schemas);
  const activeId = useStudio((s) => s.activeId);
  const comments = useStudio((s) => s.comments);
  const schema = schemas.find((s) => s.id === activeId);
  const nodes = useMemo(() => documented(schema), [schema]);

  const exportHtml = () => {
    if (!schema) return;
    const body = nodes
      .map(
        (n) =>
          `<section><h3>${n.name} <small>(${n.kind})</small></h3><p>${
            n.documentation ?? "No documentation provided."
          }</p><pre>${n.type ? `type: ${n.type}` : ""} ${n.base ? `base: ${n.base}` : ""}</pre></section>`,
      )
      .join("");
    download(
      `${schema.fileName}.html`,
      `<!doctype html><html><head><meta charset="utf-8"><title>${schema.fileName}</title><style>body{font-family:system-ui;margin:40px;max-width:800px}section{border-bottom:1px solid #ddd;padding:12px 0}pre{color:#555}</style></head><body><h1>${schema.fileName}</h1><p>Namespace: ${schema.targetNamespace ?? "none"}</p>${body}</body></html>`,
      "text/html",
    );
  };

  return (
    <AppShell>
      <div className="grid h-full grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="min-h-0 overflow-y-auto border-r panel-surface p-3">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Schemas
          </h2>
          <SchemaList />
          <div className="mt-4 space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              disabled={!schema}
              onClick={() =>
                schema &&
                download(
                  `${schema.fileName}.md`,
                  toMarkdown(schema, nodes, comments),
                  "text/markdown",
                )
              }
            >
              <FileText className="size-3.5" /> Export Markdown
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              disabled={!schema}
              onClick={exportHtml}
            >
              <FileDown className="size-3.5" /> Export HTML
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              disabled={!schema}
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" /> Export PDF (print)
            </Button>
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto p-6">
          {!schema ? (
            <p className="text-sm text-muted-foreground">Select a schema to generate docs.</p>
          ) : (
            <article className="mx-auto max-w-3xl">
              <h1 className="text-xl font-semibold">{schema.fileName}</h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {schema.targetNamespace ?? "no target namespace"}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {Object.entries(schema.stats).map(([k, v]) => (
                  <div key={k} className="rounded border bg-card p-2 text-center">
                    <p className="font-mono text-lg">{v}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">{k}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-4">
                {nodes.map((n) => {
                  const enums = n.children.filter((c) => c.kind === "enumeration");
                  const reviews = commentsFor(n, comments);
                  return (
                    <div key={n.id} className="rounded border bg-card p-3">
                      <h2 className="font-mono text-sm font-semibold">
                        {n.name}
                        <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                          {n.kind}
                        </span>
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {n.documentation ?? "No documentation provided."}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] text-muted-foreground">
                        {n.type && <span>type: {n.type}</span>}
                        {n.base && <span>base: {n.base}</span>}
                        <span>
                          occurs: {n.minOccurs ?? "1"}..{n.maxOccurs ?? "1"}
                        </span>
                        <span>line: {n.line}</span>
                      </div>
                      {enums.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {enums.map((e) => (
                            <span
                              key={e.id}
                              className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-kind-enum"
                            >
                              {e.value}
                            </span>
                          ))}
                        </div>
                      )}
                      {reviews.length > 0 && (
                        <div className="mt-3 border-t pt-2">
                          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                            Review comments
                          </p>
                          <ul className="mt-1 space-y-1 text-xs">
                            {reviews.map((comment) => (
                              <li key={comment.id}>
                                <span className="font-medium">{comment.author}:</span>{" "}
                                {comment.body}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          )}
        </section>
      </div>
    </AppShell>
  );
}
