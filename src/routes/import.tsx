import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Braces, FileStack, FileCode2, Send, Upload, Wand2 } from "lucide-react";
import { AppShell } from "@/components/studio/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { addSchemas, openXmlFile, setExplorerMode } from "@/lib/store";
import {
  copybookToJson,
  copybookToXml,
  copybookToXsd,
  parseCopybook,
} from "@/lib/copybook/parse";
import { parseSoapUiProject, type ParsedSoapUiProject } from "@/lib/soapui/parse";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import copybook & SoapUI — XSD Studio" },
      {
        name: "description",
        content:
          "Convert a COBOL copybook into an XSD and sample XML, or load requests and schemas from a SoapUI project file.",
      },
      { property: "og:title", content: "Import copybook & SoapUI — XSD Studio" },
      {
        property: "og:description",
        content: "Turn copybooks into schemas and reuse SoapUI project payloads as test data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportPage,
});

const SAMPLE_COPYBOOK = `       01  CUSTOMER-RECORD.
           05  CUST-ID              PIC 9(8).
           05  CUST-NAME.
               10  FIRST-NAME       PIC X(20).
               10  LAST-NAME        PIC X(30).
           05  CUST-BALANCE         PIC S9(7)V99.
           05  CUST-ACCOUNTS        OCCURS 3 TIMES.
               10  ACCOUNT-NUMBER   PIC X(18).
               10  ACCOUNT-TYPE     PIC X(3).`;

function ImportPage() {
  const { lang } = useLanguage();
  const nl = lang === "nl";
  const [tab, setTab] = useState<"copybook" | "soapui">("copybook");

  const [copybook, setCopybook] = useState(SAMPLE_COPYBOOK);
  const [copyName, setCopyName] = useState("copybook.xsd");
  const [xsdOut, setXsdOut] = useState("");
  const [xmlOut, setXmlOut] = useState("");
  const [jsonOut, setJsonOut] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const [project, setProject] = useState<ParsedSoapUiProject | undefined>();
  const [selected, setSelected] = useState<string>("");

  const selectedRequest = useMemo(
    () => project?.requests.find((r) => r.id === selected),
    [project, selected],
  );

  function convertCopybook() {
    const { roots, warnings: w } = parseCopybook(copybook);
    setWarnings(w);
    if (!roots.length) {
      toast.error(nl ? "Geen velden gevonden in de copybook" : "No fields found in the copybook");
      return;
    }
    setXsdOut(copybookToXsd(roots));
    setXmlOut(copybookToXml(roots));
    setJsonOut(copybookToJson(roots));
    toast.success(nl ? "Copybook omgezet" : "Copybook converted");
  }

  async function onCopybookFile(file: File) {
    setCopybook(await file.text());
    setCopyName(`${file.name.replace(/\.[^.]+$/, "")}.xsd`);
  }

  async function onProjectFile(file: File) {
    const parsed = parseSoapUiProject(await file.text(), file.name);
    setProject(parsed);
    setSelected(parsed.requests[0]?.id ?? "");
    if (parsed.errors.length) parsed.errors.forEach((e) => toast.error(e));
    else
      toast.success(
        nl
          ? `${parsed.requests.length} requests en ${parsed.schemas.length} schema's gevonden`
          : `Found ${parsed.requests.length} requests and ${parsed.schemas.length} schemas`,
      );
  }

  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-panel px-3">
          <FileStack className="size-4 text-primary" />
          <span className="text-xs font-semibold">
            {nl ? "Import: copybook & SoapUI" : "Import: copybook & SoapUI"}
          </span>
          <div className="ml-3 flex rounded border p-0.5 text-xs">
            {(["copybook", "soapui"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  tab === t
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "copybook" ? "COBOL copybook" : "SoapUI project"}
              </button>
            ))}
          </div>
          <span className="ml-auto rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
            mock data
          </span>
        </div>

        {tab === "copybook" ? (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-0 overflow-hidden">
            <div className="flex min-h-0 flex-col border-r">
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {nl ? "Copybook bron" : "Copybook source"}
                </span>
                <label className="ml-auto cursor-pointer text-[11px] text-primary hover:underline">
                  <Upload className="mr-1 inline size-3" />
                  {nl ? "Bestand kiezen" : "Choose file"}
                  <input
                    type="file"
                    accept=".cpy,.cbl,.cob,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onCopybookFile(f);
                    }}
                  />
                </label>
                <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={convertCopybook}>
                  <Wand2 className="size-3.5" />
                  {nl ? "Omzetten" : "Convert"}
                </Button>
              </div>
              <textarea
                value={copybook}
                onChange={(e) => setCopybook(e.target.value)}
                spellCheck={false}
                className="min-h-0 flex-1 resize-none bg-background p-3 font-mono text-[11px] leading-5 outline-none"
              />
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <input
                  value={copyName}
                  onChange={(e) => setCopyName(e.target.value)}
                  className="w-48 rounded border bg-background px-2 py-1 font-mono text-[11px]"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 text-xs"
                  disabled={!xsdOut}
                  onClick={() => {
                    addSchemas([{ fileName: copyName || "copybook.xsd", content: xsdOut }]);
                    setExplorerMode("xsd");
                    toast.success(nl ? "XSD geopend in Verkenner" : "XSD opened in Explorer");
                  }}
                >
                  <Send className="size-3.5" />
                  {nl ? "XSD openen" : "Open XSD"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 text-xs"
                  disabled={!xmlOut}
                  onClick={() => {
                    openXmlFile(copyName.replace(/\.xsd$/i, ".xml"), xmlOut);
                    toast.success(nl ? "XML geopend in Verkenner" : "XML opened in Explorer");
                  }}
                >
                  <FileCode2 className="size-3.5" />
                  {nl ? "XML openen" : "Open XML"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 text-xs"
                  disabled={!jsonOut}
                  onClick={() => {
                    const blob = new Blob([jsonOut], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = copyName.replace(/\.[^.]+$/, "") + ".json";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Braces className="size-3.5" />
                  {nl ? "JSON opslaan" : "Save JSON"}
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-3">
                {warnings.length > 0 && (
                  <ul className="mb-2 space-y-0.5 rounded border border-warning/40 bg-warning/10 p-2 text-[10px]">
                    {warnings.slice(0, 6).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
                {xsdOut ? (
                  <>
                    <pre className="whitespace-pre rounded border bg-panel p-3 font-mono text-[11px] leading-5">
                      {xsdOut}
                    </pre>
                    <pre className="mt-3 whitespace-pre rounded border bg-panel p-3 font-mono text-[11px] leading-5">
                      {xmlOut}
                    </pre>
                    <pre className="mt-3 whitespace-pre rounded border bg-panel p-3 font-mono text-[11px] leading-5">
                      {jsonOut}
                    </pre>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {nl
                      ? "Plak of kies een copybook en klik op Omzetten om een XSD, voorbeeld-XML en JSON te maken."
                      : "Paste or choose a copybook and press Convert to build an XSD, sample XML and JSON."}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[20rem_1fr] overflow-hidden">
            <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-r bg-panel p-3">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed p-3 text-xs text-muted-foreground hover:text-foreground">
                <Upload className="size-4" />
                {nl ? "SoapUI project (.xml) kiezen" : "Choose SoapUI project (.xml)"}
                <input
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onProjectFile(f);
                  }}
                />
              </label>

              {project && (
                <>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{project.projectName}</span>
                    <br />
                    {project.requests.length} requests · {project.schemas.length} schemas
                  </div>

                  {project.schemas.length > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5 text-xs"
                      onClick={() => {
                        addSchemas(
                          project.schemas
                            .filter((s) => s.fileName.toLowerCase().endsWith(".xsd"))
                            .map((s) => ({ fileName: s.fileName, content: s.content })),
                        );
                        setExplorerMode("xsd");
                        toast.success(nl ? "Schema's geladen" : "Schemas loaded");
                      }}
                    >
                      <Send className="size-3.5" />
                      {nl ? "Schema's laden" : "Load schemas"}
                    </Button>
                  )}

                  <div className="space-y-1">
                    {project.requests.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelected(r.id)}
                        className={`w-full rounded px-2 py-1.5 text-left text-[11px] transition-colors ${
                          selected === r.id
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        <span className="block font-medium">{r.name}</span>
                        <span className="block font-mono text-[10px] opacity-70">
                          {[r.interfaceName, r.operation].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </aside>

            <section className="flex min-h-0 flex-col">
              <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
                <span className="text-xs font-medium">
                  {selectedRequest?.name ?? (nl ? "Geen request gekozen" : "No request selected")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-7 gap-1.5 text-xs"
                  disabled={!selectedRequest}
                  onClick={() => {
                    if (!selectedRequest) return;
                    openXmlFile(`${selectedRequest.name}.xml`, selectedRequest.content);
                    toast.success(nl ? "Testdata geopend" : "Test data opened");
                  }}
                >
                  <Send className="size-3.5" />
                  {nl ? "Als testdata openen" : "Open as test data"}
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-3">
                {selectedRequest ? (
                  <pre className="whitespace-pre rounded border bg-panel p-3 font-mono text-[11px] leading-5">
                    {selectedRequest.content}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {nl
                      ? "Kies een SoapUI-projectbestand om requests en schema's te laden."
                      : "Choose a SoapUI project file to load its requests and schemas."}
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
