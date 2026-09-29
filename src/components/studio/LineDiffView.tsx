import { useMemo, useState } from "react";
import { collapseUnchanged, diffStats, lineDiff, type DiffRow } from "@/lib/diff/lineDiff";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  leftSource: string;
  rightSource: string;
  leftLabel: string;
  rightLabel: string;
}

const ROW_STYLE: Record<DiffRow["type"], string> = {
  added: "bg-added-soft/60",
  removed: "bg-removed-soft/60",
  unchanged: "",
};

const SIGN: Record<DiffRow["type"], string> = {
  added: "+",
  removed: "−",
  unchanged: " ",
};

const SIGN_STYLE: Record<DiffRow["type"], string> = {
  added: "text-added",
  removed: "text-removed",
  unchanged: "text-muted-foreground",
};

export function LineDiffView({ leftSource, rightSource, leftLabel, rightLabel }: Props) {
  const [split, setSplit] = useState(false);
  const [collapse, setCollapse] = useState(true);

  const rows = useMemo(() => lineDiff(leftSource, rightSource), [leftSource, rightSource]);
  const stats = useMemo(() => diffStats(rows), [rows]);
  const chunks = useMemo(
    () => (collapse ? collapseUnchanged(rows, 3) : rows),
    [rows, collapse],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b px-3 py-1.5 text-[11px]">
        <span className="font-mono text-muted-foreground">
          {leftLabel} → {rightLabel}
        </span>
        <span className="rounded bg-added-soft px-1.5 py-0.5 font-mono text-added">
          +{stats.added}
        </span>
        <span className="rounded bg-removed-soft px-1.5 py-0.5 font-mono text-removed">
          −{stats.removed}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => setCollapse((v) => !v)}
          >
            {collapse ? "Show all lines" : "Collapse unchanged"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => setSplit((v) => !v)}
          >
            {split ? "Unified view" : "Split view"}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto font-mono text-[11px] leading-5">
        {chunks.map((chunk, index) => {
          if ("kind" in chunk) {
            return (
              <div
                key={`gap-${index}`}
                className="border-y bg-muted/40 px-3 py-0.5 text-[10px] text-muted-foreground"
              >
                ⋯ {chunk.count} unchanged lines
              </div>
            );
          }
          if (split) {
            const showLeft = chunk.type !== "added";
            const showRight = chunk.type !== "removed";
            return (
              <div key={index} className="grid grid-cols-2 divide-x">
                <div className={cn("flex", showLeft ? ROW_STYLE[chunk.type] : "bg-muted/20")}>
                  <span className="w-10 shrink-0 select-none px-1 text-right text-muted-foreground">
                    {chunk.leftNumber ?? ""}
                  </span>
                  <pre className="flex-1 whitespace-pre-wrap break-all px-2">
                    {showLeft ? chunk.text : ""}
                  </pre>
                </div>
                <div className={cn("flex", showRight ? ROW_STYLE[chunk.type] : "bg-muted/20")}>
                  <span className="w-10 shrink-0 select-none px-1 text-right text-muted-foreground">
                    {chunk.rightNumber ?? ""}
                  </span>
                  <pre className="flex-1 whitespace-pre-wrap break-all px-2">
                    {showRight ? chunk.text : ""}
                  </pre>
                </div>
              </div>
            );
          }
          return (
            <div key={index} className={cn("flex", ROW_STYLE[chunk.type])}>
              <span className="w-10 shrink-0 select-none px-1 text-right text-muted-foreground">
                {chunk.leftNumber ?? ""}
              </span>
              <span className="w-10 shrink-0 select-none px-1 text-right text-muted-foreground">
                {chunk.rightNumber ?? ""}
              </span>
              <span className={cn("w-4 shrink-0 select-none text-center", SIGN_STYLE[chunk.type])}>
                {SIGN[chunk.type]}
              </span>
              <pre className="flex-1 whitespace-pre-wrap break-all px-2">{chunk.text}</pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
