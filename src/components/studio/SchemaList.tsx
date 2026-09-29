import { FileCode2, Trash2 } from "lucide-react";
import { removeSchema, setActive, useStudio } from "@/lib/store";
import { formatBytes } from "@/lib/xsd/parser";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function SchemaList() {
  const schemas = useStudio((s) => s.schemas);
  const activeId = useStudio((s) => s.activeId);

  return (
    <ul className="space-y-1">
      {schemas.map((schema) => {
        const errors = schema.errors.filter((e) => e.severity === "error").length;
        return (
          <li key={schema.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActive(schema.id)}
              onKeyDown={(e) => e.key === "Enter" && setActive(schema.id)}
              className={cn(
                "group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
                schema.id === activeId ? "bg-accent text-accent-foreground" : "hover:bg-secondary",
              )}
            >
              <FileCode2 className="size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono">{schema.fileName}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {formatBytes(schema.size)} · {schema.targetNamespace ?? "no namespace"}
                </span>
              </span>
              {errors > 0 && (
                <span className="rounded bg-removed-soft px-1 font-mono text-[10px] text-removed">
                  {errors}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${schema.fileName}`}
                className="size-6 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSchema(schema.id);
                }}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </li>
        );
      })}
      {schemas.length === 0 && (
        <li className="px-2 py-3 text-xs text-muted-foreground">No schemas in this workspace.</li>
      )}
    </ul>
  );
}
