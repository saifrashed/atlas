import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { addSchemas } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Uploader({ compact = false }: { compact?: boolean }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const accepted = Array.from(files).filter((f) => /\.(xsd|xml)$/i.test(f.name));
    if (!accepted.length) {
      toast.error("Only .xsd files are supported.");
      return;
    }
    const payload = await Promise.all(
      accepted.map(async (f) => ({ fileName: f.name, content: await f.text() })),
    );
    const parsed = addSchemas(payload);
    const failed = parsed.filter((p) => p.errors.some((e) => e.severity === "error")).length;
    toast.success(`${parsed.length} schema(s) added${failed ? ` — ${failed} with errors` : ""}`);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "cursor-pointer rounded-md border border-dashed text-center transition-colors",
        compact ? "px-3 py-4" : "px-6 py-10",
        over ? "border-primary bg-accent" : "border-border hover:border-primary/60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xsd,.xml"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <UploadCloud className="mx-auto size-5 text-muted-foreground" />
      <p className="mt-2 text-xs font-medium">Drop .xsd files here</p>
      {!compact && (
        <p className="mt-1 text-xs text-muted-foreground">
          Multiple files supported — everything is parsed locally in your browser.
        </p>
      )}
    </div>
  );
}
