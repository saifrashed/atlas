import { Check, Download, Loader2, Save, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio, setAutoSave, saveSchemaToDisk } from "@/lib/store";

/** Shows whether edits are written back to the file in the local folder. */
export function SaveStatus({ schemaId }: { schemaId: string }) {
  const autoSave = useStudio((s) => s.autoSave);
  const status = useStudio((s) => s.saveStatus[schemaId]);
  const linked = status && status.state !== "unlinked";

  return (
    <div className="flex items-center gap-1">
      {linked && (
        <button
          type="button"
          onClick={() => setAutoSave(!autoSave)}
          title={
            autoSave
              ? "Auto-save is on — every change is written to the file"
              : "Auto-save is off — save manually"
          }
          className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-secondary"
        >
          {status?.state === "saving" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : status?.state === "error" ? (
            <TriangleAlert className="size-3.5 text-removed" />
          ) : (
            <Check className="size-3.5 text-added" />
          )}
          {status?.state === "error"
            ? "Not saved"
            : autoSave
              ? "Auto-save on"
              : "Auto-save off"}
        </button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1 text-[11px]"
        onClick={() => void saveSchemaToDisk(schemaId, { manual: true })}
        title={linked ? "Save to the file in your folder" : "Download the edited schema"}
      >
        {linked ? <Save className="size-3.5" /> : <Download className="size-3.5" />}
        {linked ? "Save" : "Download"}
      </Button>
    </div>
  );
}
