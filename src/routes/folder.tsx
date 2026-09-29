import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  FileCode2,
  FolderOpen,
  Link2,
  Network,
  Search,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/studio/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  filesFromInput,
  findFile,
  pickLocalFolder,
  supportsLocalWrite,
  readLocalFile,
  resolvePath,
  type LocalFile,
} from "@/lib/fs/localFolder";
import { parseWsdl } from "@/lib/wsdl/parse";
import {
  openSchemaFiles,
  openXmlFile,
  setFolderSession,
  useStudio,
  type WsdlEntry,
} from "@/lib/store";
import { formatBytes } from "@/lib/xsd/parser";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/folder")({
  head: () => ({
    meta: [
      { title: "Local folder — XSD Studio" },
      {
        name: "description",
        content:
          "Open a folder from your computer and browse every WSDL, XSD and XML file, with the schemas each WSDL links to resolved automatically.",
      },
      { property: "og:title", content: "Local folder — XSD Studio" },
      {
        property: "og:description",
        content: "Browse WSDL, XSD and XML files from a local folder and follow their links.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FolderPage,
});

function FolderPage() {
  const navigate = useNavigate();
  const session = useStudio((s) => s.folderSession);
  const { folder, files, wsdls, activeWsdl, query } = session;
  const setQuery = (q: string) => setFolderSession({ query: q });
  const setActiveWsdl = (path: string) => setFolderSession({ activeWsdl: path });
  const [busy, setBusy] = useState(false);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const [unsupported, setUnsupported] = useState(false);
  useEffect(() => {
    setUnsupported(!("webkitdirectory" in document.createElement("input")));
  }, []);
  const supported = !unsupported;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? files.filter((f) => f.path.toLowerCase().includes(q)) : files;
  }, [files, query]);

  const counts = useMemo(
    () => ({
      wsdl: files.filter((f) => f.ext === "wsdl").length,
      xsd: files.filter((f) => f.ext === "xsd").length,
      xml: files.filter((f) => f.ext === "xml").length,
    }),
    [files],
  );

  const ingest = async (picked: { name: string; files: LocalFile[] }) => {
    const entries: WsdlEntry[] = [];
    for (const file of picked.files.filter((f) => f.ext === "wsdl")) {
      const parsed = parseWsdl(file.name, await readLocalFile(file));
      entries.push({
        file,
        parsed,
        links: parsed.refs
          .filter((r) => r.location)
          .map((r) => {
            const target = resolvePath(file.path, r.location as string);
            return {
              label: `${r.kind} · ${r.location as string}`,
              target,
              file: findFile(picked.files, target),
            };
          }),
      });
    }
    setFolderSession({
      folder: picked.name,
      files: picked.files,
      wsdls: entries,
      activeWsdl: entries[0]?.file.path,
    });
    toast.success(
      `${picked.files.length} file(s) found in “${picked.name}” — ${entries.length} WSDL`,
    );
  };

  const open = async () => {
    // Prefer the native directory picker: it is the only way to get write
    // access, so edits can be saved straight back into the folder. If it is
    // blocked (embedded frames, other browsers) fall back to a read-only
    // directory <input>.
    if (supportsLocalWrite()) {
      try {
        setBusy(true);
        const picked = await pickLocalFolder();
        // undefined = user cancelled the dialog; nothing more to do.
        if (picked) await ingest(picked);
        return;
      } catch {
        /* fall through to the input */
      } finally {
        setBusy(false);
      }
    }
    dirInputRef.current?.click();
  };



  const openInExplorer = async (file: LocalFile) => {
    const content = await readLocalFile(file);
    if (file.ext === "xsd")
      openSchemaFiles([{ fileName: file.name, content, handle: file.handle }]);
    else openXmlFile(file.name, content);
    void navigate({ to: "/" });
  };

  const active = wsdls.find((w) => w.file.path === activeWsdl);

  return (
    <AppShell>
      <div className="grid h-full grid-cols-1 lg:grid-cols-[320px_1fr]">
        <aside className="flex min-h-0 flex-col overflow-y-auto border-r panel-surface p-3">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Local folder
          </h2>
          <input
            ref={dirInputRef}
            type="file"
            multiple
            className="hidden"
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={(e) => {
              const list = e.target.files;
              if (!list?.length) return;
              setBusy(true);
              void ingest(filesFromInput(list))
                .catch(() => toast.error("Could not read that folder."))
                .finally(() => setBusy(false));
              e.target.value = "";
            }}
          />
          <Button size="sm" disabled={!supported || busy} onClick={() => void open()}>
            <FolderOpen className="mr-1.5 size-4" />
            {folder ? "Choose another folder" : "Open folder…"}
          </Button>
          {!supported && (
            <p className="mt-2 flex gap-1.5 rounded border bg-card p-2 text-[11px] text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-modified" />
              Your browser cannot open local folders. Use Chrome or Edge on desktop, or drag files
              into the Explorer instead.
            </p>
          )}
          {folder && files.some((f) => f.handle) && (
            <p className="mt-2 rounded border bg-card p-2 text-[11px] text-muted-foreground">
              Edits made in the Explorer are written straight back into this folder.
            </p>
          )}
          {folder && !files.some((f) => f.handle) && (
            <p className="mt-2 rounded border bg-card p-2 text-[11px] text-muted-foreground">
              Read-only mode: this browser view could not get write access, so edits are offered as
              a download instead. Open the app in its own Chrome/Edge tab to save in place.
            </p>
          )}
          {folder && (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              {folder} · {counts.wsdl} WSDL · {counts.xsd} XSD · {counts.xml} XML
            </p>
          )}

          <div className="relative mt-3">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter files…"
              className="h-8 pl-7 text-xs"
            />
          </div>

          <ul className="mt-2 space-y-0.5">
            {filtered.map((f) => (
              <li key={f.path}>
                <button
                  type="button"
                  onClick={() => {
                    if (f.ext === "wsdl") setActiveWsdl(f.path);
                    else void openInExplorer(f);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-secondary"
                >
                  {f.ext === "wsdl" ? (
                    <Workflow className="size-3.5 shrink-0 text-kind-attribute" />
                  ) : (
                    <FileCode2 className="size-3.5 shrink-0 text-kind-element" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono">{f.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {f.path}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {formatBytes(f.size)}
                  </span>
                </button>
              </li>
            ))}
            {folder && filtered.length === 0 && (
              <li className="px-2 py-3 text-xs text-muted-foreground">No matching files.</li>
            )}
          </ul>
        </aside>

        <section className="min-h-0 overflow-y-auto p-4">
          {!folder ? (
            <div className="mx-auto max-w-lg rounded border bg-card p-6 text-sm">
              <FolderOpen className="mb-3 size-6 text-primary" />
              <h3 className="font-semibold">Work straight from a folder on your computer</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Pick a folder and XSD Studio lists every WSDL, XSD and XML inside it. For each WSDL
                it resolves the schemas it imports or includes, so you can jump from a service
                definition to its schemas in one click. Files are read locally in your browser —
                nothing is uploaded.
              </p>
            </div>
          ) : !active ? (
            <p className="text-sm text-muted-foreground">
              No WSDL in this folder. Pick any file on the left to open it in the Explorer.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-mono text-sm font-semibold">{active.file.path}</h2>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  onClick={() => void openInExplorer(active.file)}
                >
                  Open in Explorer
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  disabled={!active.links.some((l) => l.file?.ext === "xsd")}
                  onClick={async () => {
                    const targets = active.links
                      .map((l) => l.file)
                      .filter((f): f is LocalFile => f?.ext === "xsd");
                    const loaded = await Promise.all(
                      targets.map(async (f) => ({
                        fileName: f.name,
                        content: await readLocalFile(f),
                        handle: f.handle,
                      })),
                    );
                    openSchemaFiles(loaded);
                    toast.success(`${loaded.length} linked schema(s) opened`);
                    void navigate({ to: "/" });
                  }}
                >
                  Open all linked schemas
                </Button>
              </div>

              {active.parsed.error && (
                <p className="rounded border bg-card p-3 text-xs text-removed">
                  {active.parsed.error}
                </p>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded border bg-card p-3 text-xs">
                  <h3 className="mb-2 flex items-center gap-1.5 font-semibold">
                    <Link2 className="size-3.5" /> Linked documents
                  </h3>
                  {active.links.length === 0 ? (
                    <p className="text-muted-foreground">
                      This WSDL has no imports or includes — its schemas are inline.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {active.links.map((l) => (
                        <li
                          key={`${l.label}-${l.target}`}
                          className="flex items-center gap-2 rounded px-1 py-1"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-mono">{l.target}</span>
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {l.label}
                            </span>
                          </span>
                          {l.file ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 shrink-0 text-[11px]"
                              onClick={() => void openInExplorer(l.file as LocalFile)}
                            >
                              Open
                            </Button>
                          ) : (
                            <span className="shrink-0 font-mono text-[10px] text-removed">
                              not found
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {active.parsed.inlineSchemas.length > 0 && (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Inline schemas: {active.parsed.inlineSchemas.join(", ")}
                    </p>
                  )}
                </div>

                <div className="rounded border bg-card p-3 text-xs">
                  <h3 className="mb-2 flex items-center gap-1.5 font-semibold">
                    <Network className="size-3.5" /> Services & operations
                  </h3>
                  <p className="mb-2 break-all font-mono text-[10px] text-muted-foreground">
                    {active.parsed.targetNamespace ?? "no target namespace"}
                  </p>
                  {active.parsed.services.map((s) => (
                    <div key={s.name} className="mb-2">
                      <p className="font-medium">{s.name}</p>
                      <ul className="ml-3 text-[11px] text-muted-foreground">
                        {s.ports.map((p) => (
                          <li key={p.name} className="truncate font-mono">
                            {p.name} → {p.address ?? p.binding}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {active.parsed.portTypes.map((pt) => (
                    <div key={pt.name} className="mb-2">
                      <p className="font-medium">{pt.name}</p>
                      <ul className="ml-3 text-[11px] text-muted-foreground">
                        {pt.operations.map((o) => (
                          <li key={o.name} className="truncate font-mono">
                            {o.name}
                            {o.input ? ` (${o.input}${o.output ? ` → ${o.output}` : ""})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <ul className="flex flex-wrap gap-1">
                {wsdls.map((w) => (
                  <li key={w.file.path}>
                    <button
                      type="button"
                      onClick={() => setActiveWsdl(w.file.path)}
                      className={cn(
                        "rounded border px-2 py-1 font-mono text-[11px]",
                        w.file.path === activeWsdl ? "bg-accent text-accent-foreground" : "hover:bg-secondary",
                      )}
                    >
                      {w.file.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
