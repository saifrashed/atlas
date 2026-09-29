import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronsDownUp,
  ChevronsUpDown,
  FileCode2,
  FilePlus2,

  Search,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { XmlTree } from "@/components/studio/XmlTree";
import { DiagramView } from "@/components/studio/DiagramView";
import { xmlToDiagram } from "@/lib/diagram/layout";
import { SourceView } from "@/components/studio/SourceView";
import { AiChatPanel } from "@/components/studio/AiChatPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseXml, SAMPLE_XML, inlineValue, type ParsedXml, type XmlNode } from "@/lib/xml/parse";
import { formatBytes } from "@/lib/xsd/parser";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";


export function XmlWorkspace({ toolbarExtra }: { toolbarExtra?: React.ReactNode }) {
  const [docs, setDocs] = useState<ParsedXml[]>(() => [
    parseXml(SAMPLE_XML.fileName, SAMPLE_XML.content),
  ]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<XmlNode | undefined>();
  const [expandSignal, setExpandSignal] = useState({ n: 0, open: true });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [paste, setPaste] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doc = docs[activeIndex];

  // Documents handed over from the Local folder screen.
  const incoming = useStudio((s) => s.xmlFiles);
  const consumed = useRef(0);
  useEffect(() => {
    if (incoming.length <= consumed.current) return;
    const fresh = incoming.slice(consumed.current).map((f) => parseXml(f.fileName, f.content));
    consumed.current = incoming.length;
    setDocs((prev) => {
      setActiveIndex(prev.length);
      return [...prev, ...fresh];
    });
    setSelected(undefined);
  }, [incoming]);



  const addFiles = useCallback(async (files: File[]) => {
    const accepted = files.filter((f) => /\.(xml|xsd|xsl|svg|rss|wsdl)$/i.test(f.name));
    if (!accepted.length) {
      toast.error("Please drop an XML-based file (.xml, .xsd, .wsdl…).");
      return;
    }
    const parsed = await Promise.all(accepted.map(async (f) => parseXml(f.name, await f.text())));
    setDocs((prev) => {
      setActiveIndex(prev.length);
      return [...prev, ...parsed];
    });
    setSelected(undefined);
    toast.success(`${parsed.length} document${parsed.length === 1 ? "" : "s"} loaded`);
  }, []);

  const selectedValue = selected ? inlineValue(selected) : undefined;

  const diagramRoot = useMemo(() => (doc?.root ? xmlToDiagram(doc.root) : undefined), [doc]);
  const nodeIndex = useMemo(() => {
    const map = new Map<string, XmlNode>();
    const walk = (n: XmlNode) => {
      map.set(n.id, n);
      n.children.forEach(walk);
    };
    if (doc?.root) walk(doc.root);
    return map;
  }, [doc]);
  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const stats = useMemo(() => doc?.stats ?? { elements: 0, attributes: 0, maxDepth: 0 }, [doc]);

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[280px_1fr_320px]">
      <aside className="flex min-h-0 flex-col overflow-y-auto border-r panel-surface p-3">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          XML documents
        </h2>

        <Button
          size="sm"
          className="mb-2 w-full text-xs"
          onClick={() => {
            const blank = parseXml(
              `untitled-${docs.length + 1}.xml`,
              `<?xml version="1.0" encoding="UTF-8"?>\n<Root>\n  <Item>value</Item>\n</Root>\n`,
            );
            setDocs((prev) => {
              setActiveIndex(prev.length);
              return [...prev, blank];
            });
            setSelected(undefined);
            toast.success("New XML document created");
          }}
        >
          <FilePlus2 className="size-3.5" />
          New XML from scratch
        </Button>


        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addFiles(Array.from(e.dataTransfer.files));
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "cursor-pointer rounded border border-dashed p-3 text-center text-[11px] transition-colors",
            dragging ? "border-primary bg-accent" : "hover:bg-secondary",
          )}
        >
          <Upload className="mx-auto mb-1 size-4 text-muted-foreground" />
          Drop .xml files here or click to browse
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".xml,.xsd,.wsdl,.xsl,.svg"
            className="hidden"
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>

        <ul className="mt-3 space-y-1">
          {docs.map((d, i) => (
            <li key={`${d.fileName}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  setActiveIndex(i);
                  setSelected(undefined);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
                  i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-secondary",
                )}
              >
                <FileCode2 className="size-3.5 shrink-0 text-kind-element" />
                <span className="truncate">{d.fileName}</span>
                {d.error ? (
                  <AlertTriangle className="ml-auto size-3.5 shrink-0 text-removed" />
                ) : (
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                    {formatBytes(d.size)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded border bg-card p-2 text-[11px]">
          <h3 className="mb-1 font-semibold">Document stats</h3>
          <dl className="space-y-0.5 text-muted-foreground">
            <div className="flex justify-between gap-2">
              <dt>Elements</dt>
              <dd className="font-mono">{stats.elements}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Attributes</dt>
              <dd className="font-mono">{stats.attributes}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Max depth</dt>
              <dd className="font-mono">{stats.maxDepth}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-4">
          <h3 className="mb-1 text-[11px] font-semibold">Paste XML</h3>
          <Textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="<root>…</root>"
            className="h-24 font-mono text-[11px]"
          />
          <Button
            size="sm"
            className="mt-2 w-full"
            disabled={!paste.trim()}
            onClick={() => {
              const parsed = parseXml(`pasted-${docs.length + 1}.xml`, paste);
              setDocs((prev) => {
                setActiveIndex(prev.length);
                return [...prev, parsed];
              });
              setPaste("");
              setSelected(undefined);
              if (parsed.error) toast.error("XML could not be parsed — see the tree panel.");
            }}
          >
            Open in tree view
          </Button>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
          {toolbarExtra}
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search nodes, attributes, values…"
              className="h-8 pl-7 text-xs"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setCollapsed(new Set());
              setExpandSignal((s) => ({ n: s.n + 1, open: true }));
            }}
          >
            <ChevronsUpDown className="mr-1 size-3.5" /> Expand all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              const ids = new Set<string>();
              nodeIndex.forEach((n) => {
                if (n.children.length) ids.add(n.id);
              });
              if (doc?.root) ids.delete(doc.root.id);
              setCollapsed(ids);
              setExpandSignal((s) => ({ n: s.n + 1, open: false }));
            }}
          >
            <ChevronsDownUp className="mr-1 size-3.5" /> Collapse all
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}
            >
              <ZoomOut className="size-4" />
            </Button>
            <span className="w-10 text-center font-mono text-[11px] text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)))}
            >
              <ZoomIn className="size-4" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="diagram" className="flex min-h-0 flex-1 flex-col gap-0">
          <TabsList className="m-2 w-fit">
            <TabsTrigger value="diagram">Diagram</TabsTrigger>
            <TabsTrigger value="tree">Outline</TabsTrigger>
            <TabsTrigger value="source">Source</TabsTrigger>
          </TabsList>
          <TabsContent value="diagram" className="min-h-0 flex-1 overflow-hidden">
            {doc?.error ? (
              <div className="m-3 flex items-start gap-2 rounded border bg-card p-3 text-xs">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-removed" />
                <div>
                  <p className="font-medium">This document is not well-formed XML.</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{doc.error}</p>
                </div>
              </div>
            ) : (
              <DiagramView
                root={diagramRoot}
                zoom={zoom}
                collapsed={collapsed}
                onToggle={toggleCollapsed}
                selectedId={selected?.id}
                onSelect={(n) => setSelected(nodeIndex.get(n.id) ?? selected)}
                emptyLabel="No document loaded. Drop an .xml file or paste markup to begin."
              />
            )}
          </TabsContent>
          <TabsContent value="tree" className="min-h-0 flex-1 overflow-auto ide-grid">
            {doc?.error ? (
              <div className="m-3 flex items-start gap-2 rounded border bg-card p-3 text-xs">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-removed" />
                <div>
                  <p className="font-medium">This document is not well-formed XML.</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{doc.error}</p>
                </div>
              </div>
            ) : (
              <XmlTree
                root={doc?.root}
                query={query}
                zoom={zoom}
                expandSignal={expandSignal}
                selectedId={selected?.id}
                onSelect={setSelected}
              />
            )}
          </TabsContent>
          <TabsContent value="source" className="min-h-0 flex-1 overflow-hidden">
            {doc ? (
              <SourceView
                content={doc.content}
                onSave={(next) => {
                  setDocs((prev) =>
                    prev.map((d, i) => (i === activeIndex ? parseXml(d.fileName, next) : d)),
                  );
                  setSelected(undefined);
                }}
              />
            ) : (
              <p className="p-6 text-sm text-muted-foreground">No document loaded.</p>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <aside className="flex min-h-0 flex-col border-l panel-surface">
        <Tabs defaultValue="properties" className="flex min-h-0 flex-1 flex-col gap-0">
          <TabsList className="m-2 w-fit">
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="ai">AI chat</TabsTrigger>
          </TabsList>
          <TabsContent value="properties" className="min-h-0 flex-1 overflow-y-auto p-3">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Node properties
            </h2>
            {!selected ? (
              <p className="text-xs text-muted-foreground">
                Select a node in the tree to inspect its attributes and value.
              </p>
            ) : (
              <div className="space-y-3 text-xs">
            <div className="rounded border bg-card p-2">
              <p className="font-mono text-sm">{selected.name}</p>
              <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                {selected.path || "/"}
              </p>
            </div>
            <dl className="space-y-1 rounded border bg-card p-2">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Kind</dt>
                <dd className="font-mono">{selected.kind}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Depth</dt>
                <dd className="font-mono">{selected.depth}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Children</dt>
                <dd className="font-mono">{selected.children.length}</dd>
              </div>
            </dl>
            {(selectedValue ?? selected.value) && (
              <div className="rounded border bg-card p-2">
                <h3 className="mb-1 font-semibold">Value</h3>
                <p className="break-words font-mono text-[11px] text-syntax-value">
                  {selectedValue ?? selected.value}
                </p>
              </div>
            )}
            {selected.attributes.length > 0 && (
              <div className="rounded border bg-card p-2">
                <h3 className="mb-1 font-semibold">Attributes</h3>
                <ul className="space-y-1">
                  {selected.attributes.map((a) => (
                    <li key={a.name} className="flex justify-between gap-2 font-mono text-[11px]">
                      <span className="text-kind-attribute">{a.name}</span>
                      <span className="truncate text-syntax-value">{a.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
              </div>
            )}
          </TabsContent>
          <TabsContent value="ai" className="min-h-0 flex-1 overflow-hidden">
            <AiChatPanel content={doc?.content} fileName={doc?.fileName} documentKind="XML" />
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}
