import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { AppShell } from "@/components/studio/AppShell";
import { SourceView } from "@/components/studio/SourceView";
import { LineDiffView } from "@/components/studio/LineDiffView";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setCompare, useStudio } from "@/lib/store";
import { diffSchemas, diffSummary } from "@/lib/xsd/diff";
import type { DiffStatus } from "@/lib/xsd/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Schema Comparison — XSD Studio" },
      {
        name: "description",
        content:
          "Compare two XSD schemas side by side: added, removed and modified elements, types and attributes.",
      },
      { property: "og:title", content: "Schema Comparison — XSD Studio" },
      {
        property: "og:description",
        content: "Colour-coded XSD diff with exportable comparison reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComparePage,
});

const STATUS_STYLE: Record<DiffStatus, string> = {
  added: "border-l-added bg-added-soft/40",
  removed: "border-l-removed bg-removed-soft/40",
  modified: "border-l-modified bg-modified-soft/40",
  unchanged: "border-l-border",
};

function ComparePage() {
  const schemas = useStudio((s) => s.schemas);
  const leftId = useStudio((s) => s.compareLeftId);
  const rightId = useStudio((s) => s.compareRightId);
  const left = schemas.find((s) => s.id === leftId);
  const right = schemas.find((s) => s.id === rightId);
  const [showUnchanged, setShowUnchanged] = useState(false);

  const entries = useMemo(() => diffSchemas(left, right), [left, right]);
  const summary = diffSummary(entries);
  const visible = entries.filter((e) => showUnchanged || e.status !== "unchanged");

  const exportReport = () => {
    const lines = [
      `# XSD comparison report`,
      ``,
      `Base: ${left?.fileName ?? "—"}`,
      `Target: ${right?.fileName ?? "—"}`,
      ``,
      `Added: ${summary.added} · Removed: ${summary.removed} · Modified: ${summary.modified} · Unchanged: ${summary.unchanged}`,
      ``,
      ...entries
        .filter((e) => e.status !== "unchanged")
        .map(
          (e) =>
            `- [${e.status.toUpperCase()}] ${e.kind} ${e.path}${e.details.length ? ` — ${e.details.join("; ")}` : ""}`,
        ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "xsd-comparison-report.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2">
          <Select value={leftId ?? ""} onValueChange={(v) => setCompare("left", v)}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="Base schema" />
            </SelectTrigger>
            <SelectContent>
              {schemas.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.fileName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">vs</span>
          <Select value={rightId ?? ""} onValueChange={(v) => setCompare("right", v)}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="Target schema" />
            </SelectTrigger>
            <SelectContent>
              {schemas.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.fileName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="rounded bg-added-soft px-1.5 py-0.5 text-added">
              +{summary.added}
            </span>
            <span className="rounded bg-removed-soft px-1.5 py-0.5 text-removed">
              −{summary.removed}
            </span>
            <span className="rounded bg-modified-soft px-1.5 py-0.5 text-modified">
              ~{summary.modified}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowUnchanged((v) => !v)}
            >
              {showUnchanged ? "Hide" : "Show"} unchanged
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={exportReport}>
              <Download className="size-3.5" /> Export report
            </Button>
          </div>
        </div>

        <Tabs defaultValue="changes" className="flex min-h-0 flex-1 flex-col gap-0">
          <TabsList className="m-2 w-fit">
            <TabsTrigger value="changes">Change list</TabsTrigger>
            <TabsTrigger value="linediff">Line diff</TabsTrigger>
            <TabsTrigger value="side">Side-by-side source</TabsTrigger>
          </TabsList>

          <TabsContent value="changes" className="min-h-0 flex-1 overflow-y-auto p-3">
            <ul className="space-y-1">
              {visible.map((e) => (
                <li
                  key={e.id}
                  className={cn("rounded border border-l-4 bg-card p-2 text-xs", STATUS_STYLE[e.status])}
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                      {e.kind}
                    </span>
                    <span className="truncate font-mono">{e.path}</span>
                    <span className="ml-auto text-[10px] uppercase text-muted-foreground">
                      {e.status}
                    </span>
                  </div>
                  {e.details.length > 0 && (
                    <ul className="mt-1 space-y-0.5 pl-1 font-mono text-[10px] text-muted-foreground">
                      {e.details.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
              {visible.length === 0 && (
                <li className="text-xs text-muted-foreground">
                  No differences detected between these schemas.
                </li>
              )}
            </ul>
          </TabsContent>

          <TabsContent value="linediff" className="min-h-0 flex-1">
            {left && right ? (
              <LineDiffView
                leftSource={left.content}
                rightSource={right.content}
                leftLabel={left.fileName}
                rightLabel={right.fileName}
              />
            ) : (
              <p className="p-3 text-xs text-muted-foreground">
                Select a base and a target schema to see the line-by-line diff.
              </p>
            )}
          </TabsContent>

          <TabsContent value="side" className="min-h-0 flex-1">
            <div className="grid h-full grid-cols-2 divide-x">
              <div className="flex min-h-0 flex-col">
                <div className="border-b px-3 py-1 font-mono text-[11px] text-muted-foreground">
                  {left?.fileName ?? "—"}
                </div>
                <div className="min-h-0 flex-1">
                  {left && <SourceView content={left.content} />}
                </div>
              </div>
              <div className="flex min-h-0 flex-col">
                <div className="border-b px-3 py-1 font-mono text-[11px] text-muted-foreground">
                  {right?.fileName ?? "—"}
                </div>
                <div className="min-h-0 flex-1">
                  {right && <SourceView content={right.content} />}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
