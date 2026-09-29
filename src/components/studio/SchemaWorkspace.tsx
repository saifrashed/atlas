import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, ZoomIn, ZoomOut, AlertTriangle, CheckCircle2, Info, FilePlus2 } from "lucide-react";
import { SchemaList } from "@/components/studio/SchemaList";
import { SchemaTree } from "@/components/studio/SchemaTree";
import { DiagramView } from "@/components/studio/DiagramView";
import { xsdToDiagram } from "@/lib/diagram/layout";
import { Uploader } from "@/components/studio/Uploader";
import { PropertiesPanel } from "@/components/studio/PropertiesPanel";
import { AiChatPanel } from "@/components/studio/AiChatPanel";

import { SourceView } from "@/components/studio/SourceView";
import { SaveStatus } from "@/components/studio/SaveStatus";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStudio, createBlankSchema, renameSchema, updateSchemaSource } from "@/lib/store";
import { formatBytes } from "@/lib/xsd/parser";
import type { XsdNode } from "@/lib/xsd/types";


export function SchemaWorkspace({ toolbarExtra }: { toolbarExtra?: React.ReactNode }) {
  const schemas = useStudio((s) => s.schemas);
  const activeId = useStudio((s) => s.activeId);
  const schema = schemas.find((s) => s.id === activeId);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [zoom, setZoom] = useState(1);
  const [newName, setNewName] = useState("");
  const [newNs, setNewNs] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [nsDraft, setNsDraft] = useState("");
  const lastSchemaId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (schema && schema.id !== lastSchemaId.current) {
      lastSchemaId.current = schema.id;
      setTitleDraft(schema.fileName);
      setNsDraft(schema.targetNamespace ?? "");
    }
  }, [schema]);


  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const diagramRoot = useMemo(
    () => (schema?.root ? xsdToDiagram(schema.root) : undefined),
    [schema],
  );
  const nodeIndex = useMemo(() => {
    const map = new Map<string, XsdNode>();
    const walk = (n: XsdNode) => {
      map.set(n.id, n);
      n.children.forEach(walk);
    };
    if (schema?.root) walk(schema.root);
    return map;
  }, [schema]);
  const selected = selectedId ? nodeIndex.get(selectedId) : undefined;
  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const errorLines = useMemo(() => schema?.errors.map((e) => e.line) ?? [], [schema]);

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[280px_1fr_320px]">
      <aside className="flex min-h-0 flex-col overflow-y-auto border-r panel-surface p-3">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Workspace
        </h2>
        <div className="mb-2 space-y-1.5 rounded border bg-card p-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="order.xsd"
            className="h-7 text-xs"
          />
          <Input
            value={newNs}
            onChange={(e) => setNewNs(e.target.value)}
            placeholder="http://example.com/order (optional)"
            className="h-7 text-xs"
          />
          <Button
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              const created = createBlankSchema(newName, newNs);
              if (created) setSelectedId(created.root?.id);
              setNewName("");
              setNewNs("");
            }}
          >
            <FilePlus2 className="size-3.5" />
            New schema from scratch
          </Button>
        </div>
        <Uploader compact />
        <div className="mt-3">
          <SchemaList />
        </div>

        {schema && (
          <div className="mt-4 space-y-1.5 rounded border bg-card p-2">
            <h3 className="text-[11px] font-semibold">Schema title</h3>
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder="file name.xsd"
              className="h-7 text-xs"
            />
            <Input
              value={nsDraft}
              onChange={(e) => setNsDraft(e.target.value)}
              placeholder="target namespace"
              className="h-7 text-xs"
            />
            <Button
              size="sm"
              variant="secondary"
              className="w-full text-xs"
              onClick={() => renameSchema(schema.id, titleDraft, nsDraft)}
            >
              Rename schema
            </Button>
          </div>
        )}


        {schema && (
          <div className="mt-4 rounded border bg-card p-2 text-[11px]">
            <h3 className="mb-1 font-semibold">File metadata</h3>
            <dl className="space-y-0.5 text-muted-foreground">
              <div className="flex justify-between gap-2">
                <dt>Size</dt>
                <dd className="font-mono">{formatBytes(schema.size)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Namespace</dt>
                <dd className="truncate font-mono">{schema.targetNamespace ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Elements</dt>
                <dd className="font-mono">{schema.stats.elements}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Complex types</dt>
                <dd className="font-mono">{schema.stats.complexTypes}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Simple types</dt>
                <dd className="font-mono">{schema.stats.simpleTypes}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Imports / includes</dt>
                <dd className="font-mono">{schema.dependencies.length}</dd>
              </div>
            </dl>
          </div>
        )}
      </aside>

      <section className="flex min-h-0 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
          {toolbarExtra}
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search elements, types, attributes…"
              className="h-8 pl-7 text-xs"
            />
          </div>
          <div className="ml-auto flex items-center gap-1">
            {schema && <SaveStatus schemaId={schema.id} />}
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
            <TabsTrigger value="validation">
              Validation
              {schema?.errors.length ? ` (${schema.errors.length})` : ""}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="diagram" className="min-h-0 flex-1 overflow-hidden">
            <DiagramView
              root={diagramRoot}
              zoom={zoom}
              collapsed={collapsed}
              onToggle={toggleCollapsed}
              selectedId={selected?.id}
              onSelect={(n) => setSelectedId(n.id)}
              emptyLabel="No schema selected. Upload an .xsd file to begin."
            />
          </TabsContent>
          <TabsContent value="tree" className="min-h-0 flex-1 overflow-auto ide-grid">
            <SchemaTree
              root={schema?.root}
              query={query}
              zoom={zoom}
              selectedId={selected?.id}
              onSelect={(n) => setSelectedId(n.id)}
            />
          </TabsContent>
          <TabsContent value="source" className="min-h-0 flex-1 overflow-hidden">
            {schema ? (
              <SourceView
                content={schema.content}
                highlightLine={selected?.line}
                errorLines={errorLines}
                onSave={(next) => {
                  updateSchemaSource(schema.id, next);
                  setSelectedId(undefined);
                }}
              />
            ) : (
              <p className="p-6 text-sm text-muted-foreground">No schema selected.</p>
            )}
          </TabsContent>
          <TabsContent value="validation" className="min-h-0 flex-1 overflow-auto p-3">
            {!schema?.errors.length ? (
              <div className="flex items-center gap-2 rounded border bg-card p-3 text-sm">
                <CheckCircle2 className="size-4 text-added" />
                Schema parsed successfully — no syntax errors detected.
              </div>
            ) : (
              <ul className="space-y-2">
                {schema.errors.map((issue) => (
                  <li key={issue.id} className="rounded border bg-card p-3 text-xs">
                    <div className="flex items-center gap-2">
                      {issue.severity === "error" ? (
                        <AlertTriangle className="size-3.5 text-removed" />
                      ) : (
                        <Info className="size-3.5 text-modified" />
                      )}
                      <span className="font-medium">{issue.message}</span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                        line {issue.line}
                      </span>
                    </div>
                    {issue.detail && (
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {issue.detail}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
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
          <TabsContent value="properties" className="min-h-0 flex-1 overflow-y-auto">
            <PropertiesPanel node={selected} schemaId={schema?.id} />
          </TabsContent>
          <TabsContent value="ai" className="min-h-0 flex-1 overflow-hidden">
            <AiChatPanel />
          </TabsContent>
        </Tabs>
      </aside>

    </div>
  );
}
