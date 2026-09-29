import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/studio/AppShell";
import { SchemaWorkspace } from "@/components/studio/SchemaWorkspace";
import { XmlWorkspace } from "@/components/studio/XmlWorkspace";
import { setExplorerMode, useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Explorer — XSD Studio" },
      {
        name: "description",
        content:
          "Upload and explore XSD schemas and XML documents in one interactive explorer with diagram, outline, source and validation views.",
      },
      { property: "og:title", content: "Explorer — XSD Studio" },
      {
        property: "og:description",
        content: "One explorer for XSD schemas and XML documents: diagram, outline, source, validation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExplorerPage,
});

type Mode = "xsd" | "xml";

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const options: { value: Mode; label: string }[] = [
    { value: "xsd", label: "XSD schema" },
    { value: "xml", label: "XML document" },
  ];
  return (
    <div className="flex shrink-0 items-center rounded border bg-secondary/50 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            mode === o.value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ExplorerPage() {
  const mode = useStudio((s) => s.explorerMode);
  const toolbar = <ModeSwitch mode={mode} onChange={setExplorerMode} />;

  return (
    <AppShell>
      {mode === "xsd" ? (
        <SchemaWorkspace toolbarExtra={toolbar} />
      ) : (
        <XmlWorkspace toolbarExtra={toolbar} />
      )}
    </AppShell>
  );
}

