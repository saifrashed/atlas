import { useEffect, useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SourceView({
  content,
  highlightLine,
  errorLines = [],
  onSave,
}: {
  content: string;
  highlightLine?: number | undefined;
  errorLines?: number[] | undefined;
  /** When provided, the source becomes editable and this saves the new text. */
  onSave?: ((next: string) => void) | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  useEffect(() => {
    if (!editing) setDraft(content);
  }, [content, editing]);

  const lines = content.split("\n");

  return (
    <div className="flex h-full flex-col">
      {onSave && (
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
          <span className="text-[11px] text-muted-foreground">
            {editing ? "Editing source — changes rebuild the diagram" : "Read-only view"}
          </span>
          <div className="ml-auto flex gap-1">
            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setDraft(content);
                    setEditing(false);
                  }}
                >
                  <X className="size-3.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    onSave(draft);
                    setEditing(false);
                  }}
                >
                  <Save className="size-3.5" />
                  Apply source
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                onClick={() => {
                  setDraft(content);
                  setEditing(true);
                }}
              >
                <Pencil className="size-3.5" />
                Edit source
              </Button>
            )}
          </div>
        </div>
      )}

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="h-full min-h-0 flex-1 resize-none bg-card p-3 font-mono text-[11px] leading-5 text-foreground outline-none"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto bg-card font-mono text-[11px] leading-5">
          {lines.map((line, i) => {
            const n = i + 1;
            const isError = errorLines.includes(n);
            return (
              <div
                key={n}
                className={cn(
                  "flex gap-3 px-3",
                  isError && "bg-removed-soft",
                  highlightLine === n && "bg-accent",
                )}
              >
                <span className="w-10 shrink-0 select-none text-right text-muted-foreground">
                  {n}
                </span>
                <code className="whitespace-pre text-foreground/90">{line}</code>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
