import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, Download, FileCode2, Play, Send, Sparkle, Wand2, PackageOpen } from "lucide-react";
import { AppShell } from "@/components/studio/AppShell";
import { SchemaList } from "@/components/studio/SchemaList";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { openXmlFile, useStudio } from "@/lib/store";
import { buildSoapUiProject, splitSamples } from "@/lib/soapui/export";
import {
  DEFAULT_GENERATE_OPTIONS,
  generateXmlInstance,
  rootElements,
  wrapSoapEnvelope,
} from "@/lib/xsd/generate";

export const Route = createFileRoute("/generate")({
  head: () => ({
    meta: [
      { title: "Test Data Generator — XSD Studio" },
      {
        name: "description",
        content:
          "Generate synthetic XML sample documents and SOAP requests from your XSD schemas and WSDL operations.",
      },
      { property: "og:title", content: "Test Data Generator — XSD Studio" },
      {
        property: "og:description",
        content: "Create fictional demo XML payloads that match an XSD or WSDL operation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GeneratePage,
});

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/xml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function GeneratePage() {
  const schemas = useStudio((s) => s.schemas);
  const activeId = useStudio((s) => s.activeId);
  const wsdls = useStudio((s) => s.folderSession.wsdls);

  const schema = schemas.find((s) => s.id === activeId) ?? schemas[0];
  const roots = useMemo(() => rootElements(schema), [schema]);

  const [mode, setMode] = useState<"xsd" | "wsdl">("xsd");
  const [rootName, setRootName] = useState("");
  const [repeat, setRepeat] = useState(DEFAULT_GENERATE_OPTIONS.repeat);
  const [includeOptional, setIncludeOptional] = useState(true);
  const [seed, setSeed] = useState(DEFAULT_GENERATE_OPTIONS.seed);
  const [count, setCount] = useState(1);
  const [operation, setOperation] = useState("");
  const [output, setOutput] = useState("");
  const [useAi, setUseAi] = useState(false);
  const [aiInstructions, setAiInstructions] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (roots.length && !roots.some((r) => r.name === rootName)) {
      setRootName(roots[0]?.name ?? "");
    }
  }, [roots, rootName]);

  const operations = useMemo(
    () =>
      wsdls.flatMap((w) =>
        w.parsed.portTypes.flatMap((pt) =>
          pt.operations.map((op) => ({
            id: `${w.file.name}::${pt.name}::${op.name}`,
            label: `${op.name} — ${pt.name} (${w.file.name})`,
            name: op.name,
            input: op.input,
            wsdl: w.file.name,
          })),
        ),
      ),
    [wsdls],
  );

  const fileBase = (schema?.fileName ?? "schema").replace(/\.xsd$/i, "");

  function buildOne(index: number) {
    if (!schema) return "";
    if (mode === "xsd") {
      return generateXmlInstance(schema, rootName, {
        repeat,
        includeOptional,
        seed: seed + index * 977,
      });
    }
    const op = operations.find((o) => o.id === operation);
    const target =
      roots.find(
        (r) =>
          r.name &&
          op &&
          (r.name.toLowerCase() === op.name.toLowerCase() ||
            r.name.toLowerCase().includes(op.name.toLowerCase())),
      )?.name ?? rootName;
    const payload = generateXmlInstance(schema, target, {
      repeat,
      includeOptional,
      seed: seed + index * 977,
    });
    return wrapSoapEnvelope(payload, op ? `${op.wsdl}/${op.name}` : undefined);
  }

  async function generateWithAi() {
    if (!schema) return;
    setBusy(true);
    setOutput("");
    try {
      const op = operations.find((o) => o.id === operation);
      const res = await fetch("/api/ai-testdata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema: schema.content,
          fileName: schema.fileName,
          rootName: mode === "wsdl" && op ? op.name : rootName,
          count: Math.max(1, Math.min(count, 5)),
          repeat,
          includeOptional,
          soap: mode === "wsdl",
          instructions: aiInstructions,
          example: buildOne(0).slice(0, 20_000),
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Request failed (${res.status})`);
      const data = (await res.json()) as { text?: string };
      const text = (data.text ?? "").trim();
      if (!text) throw new Error("Empty AI response");
      setOutput(text);
      toast.success("AI test data generated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function generate() {
    if (!schema) return;
    if (useAi) {
      void generateWithAi();
      return;
    }
    const docs = Array.from({ length: Math.max(1, Math.min(count, 10)) }, (_, i) => buildOne(i));
    setOutput(
      docs.length === 1
        ? docs[0]!
        : docs
            .map((d, i) => `<!-- ===== Sample ${i + 1} of ${docs.length} ===== -->\n${d}`)
            .join("\n"),
    );
  }

  return (
    <AppShell>
      <div className="flex h-full min-h-0">
        <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r bg-panel p-3">
          <div>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Schemas
            </h2>
            <SchemaList />
          </div>

          <div className="space-y-3 border-t pt-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Source
            </h2>
            <div className="flex rounded border p-0.5 text-xs">
              {(["xsd", "wsdl"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded px-2 py-1 font-medium transition-colors ${
                    mode === m
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "xsd" ? "From XSD" : "From WSDL"}
                </button>
              ))}
            </div>

            {mode === "xsd" ? (
              <label className="block text-xs">
                <span className="mb-1 block text-muted-foreground">Root element</span>
                <select
                  value={rootName}
                  onChange={(e) => setRootName(e.target.value)}
                  className="w-full rounded border bg-background px-2 py-1.5 font-mono text-xs"
                >
                  {roots.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block text-xs">
                <span className="mb-1 block text-muted-foreground">WSDL operation</span>
                <select
                  value={operation}
                  onChange={(e) => setOperation(e.target.value)}
                  className="w-full rounded border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="">Select an operation…</option>
                  {operations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {operations.length === 0 && (
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    Open a folder with WSDL files on the Local folder tab first.
                  </span>
                )}
              </label>
            )}
          </div>

          <div className="space-y-3 border-t pt-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Options
            </h2>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Repeats per list element</span>
              <input
                type="number"
                min={1}
                max={10}
                value={repeat}
                onChange={(e) => setRepeat(Number(e.target.value) || 1)}
                className="w-full rounded border bg-background px-2 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Number of documents</span>
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
                className="w-full rounded border bg-background px-2 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Seed</span>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || 1)}
                className="w-full rounded border bg-background px-2 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={includeOptional}
                onChange={(e) => setIncludeOptional(e.target.checked)}
              />
              Include optional elements
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
              Generate with AI
            </label>
            {useAi && (
              <label className="block text-xs">
                <span className="mb-1 block text-muted-foreground">Extra instructions (optional)</span>
                <textarea
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                  placeholder="e.g. Dutch addresses, amounts between 10 and 500"
                  className="min-h-16 w-full resize-none rounded border bg-background px-2 py-1.5 text-xs"
                />
              </label>
            )}
            <Button className="w-full gap-2" onClick={generate} disabled={!schema || busy}>
              {useAi ? <Sparkle className="size-3.5" /> : <Play className="size-3.5" />}
              {busy ? "Generating…" : useAi ? "Generate with AI" : "Generate"}
            </Button>
            {useAi && (
              <p className="text-[10px] text-muted-foreground">
                AI output is illustrative synthetic demo data — validate before use.
              </p>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-panel px-3">
            <Wand2 className="size-4 text-primary" />
            <span className="text-xs font-semibold">Synthetic test data</span>
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
              mock data
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={!output}
                onClick={() => {
                  navigator.clipboard.writeText(output);
                  toast.success("Copied to clipboard");
                }}
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={!output}
                onClick={() => download(`${fileBase}-sample.xml`, output)}
              >
                <Download className="size-3.5" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={!output}
                onClick={() => {
                  const op = operations.find((o) => o.id === operation);
                  const samples = splitSamples(output);
                  const project = buildSoapUiProject({
                    projectName: `${fileBase}-testdata`,
                    interfaceName: op ? op.wsdl : `${fileBase}-interface`,
                    soapAction: op ? `${op.wsdl}/${op.name}` : "",
                    soap: mode === "wsdl",
                    requests: samples.map((body, i) => ({
                      name: `${op?.name ?? rootName ?? fileBase}${samples.length > 1 ? ` ${i + 1}` : ""}`,
                      body,
                    })),
                  });
                  download(`${fileBase}-soapui-project.xml`, project);
                  toast.success("SoapUI request file exported");
                }}
              >
                <PackageOpen className="size-3.5" />
                Export to SoapUI
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={!output}
                onClick={() => {
                  openXmlFile(`${fileBase}-sample.xml`, output);
                  toast.success("Opened in Explorer");
                }}
              >
                <Send className="size-3.5" />
                Open in Explorer
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-3">
            {!schema ? (
              <p className="text-xs text-muted-foreground">Load an XSD schema first.</p>
            ) : output ? (
              <pre className="whitespace-pre rounded border bg-panel p-3 font-mono text-[11px] leading-5">
                {output}
              </pre>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                <FileCode2 className="size-8 opacity-40" />
                <p>Pick a root element or WSDL operation and press Generate.</p>
                <p className="max-w-sm text-[11px]">
                  All values are fictional demo data — never use them as real records.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
