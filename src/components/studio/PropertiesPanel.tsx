import { useEffect, useState } from "react";
import { MessageSquarePlus, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { XsdNode, XsdNodeKind } from "@/lib/xsd/types";
import { XSD_BUILTIN_TYPES } from "@/lib/xsd/datatypes";
import { addChildNode, addComment, deleteNode, updateNodeProps, useStudio } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const ADDABLE: { kind: XsdNodeKind; label: string; defaults?: Record<string, string> }[] = [
  { kind: "element", label: "Element", defaults: { type: "xs:string" } },
  { kind: "attribute", label: "Attribute", defaults: { type: "xs:string" } },
  { kind: "complexType", label: "Complex type" },
  { kind: "simpleType", label: "Simple type" },
  { kind: "sequence", label: "Sequence" },
  { kind: "choice", label: "Choice" },
  { kind: "enumeration", label: "Enumeration value" },
];

const FACET_KINDS: { kind: XsdNodeKind; label: string; placeholder: string }[] = [
  { kind: "pattern", label: "pattern (regex)", placeholder: "[A-Z]{3,3}" },
  { kind: "length", label: "length", placeholder: "10" },
  { kind: "minLength", label: "minLength", placeholder: "1" },
  { kind: "maxLength", label: "maxLength", placeholder: "35" },
  { kind: "minInclusive", label: "minInclusive", placeholder: "0" },
  { kind: "maxInclusive", label: "maxInclusive", placeholder: "100" },
  { kind: "minExclusive", label: "minExclusive", placeholder: "0" },
  { kind: "maxExclusive", label: "maxExclusive", placeholder: "100" },
  { kind: "totalDigits", label: "totalDigits", placeholder: "18" },
  { kind: "fractionDigits", label: "fractionDigits", placeholder: "2" },
  { kind: "whiteSpace", label: "whiteSpace", placeholder: "collapse" },
  { kind: "enumeration", label: "enumeration", placeholder: "VALUE" },
];

const FACET_SET = new Set<string>(FACET_KINDS.map((f) => f.kind));

function FacetEditor({ node, schemaId }: { node: XsdNode; schemaId: string }) {
  // Facets live on xs:restriction; target it when the selection is its parent.
  const target =
    node.kind === "restriction"
      ? node
      : (node.children.find((c) => c.kind === "restriction") ??
        node.children
          .find((c) => c.kind === "simpleType")
          ?.children.find((c) => c.kind === "restriction") ??
        node);
  const facets = target.children.filter((c) => FACET_SET.has(c.kind));
  const [kind, setKind] = useState<XsdNodeKind>("pattern");
  const [value, setValue] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [base, setBase] = useState("xs:string");
  const placeholder = FACET_KINDS.find((f) => f.kind === kind)?.placeholder ?? "value";
  const hasRestriction = target.kind === "restriction";
  const canCreate = ["element", "attribute", "simpleType"].includes(node.kind);

  const createRestriction = () => {
    const inlineNeeded = node.kind === "element" || node.kind === "attribute";
    let parentId = node.id;
    if (inlineNeeded) {
      // An inline simpleType and a type attribute are mutually exclusive in XSD.
      updateNodeProps(schemaId, node.id, { type: "" });
      parentId = addChildNode(schemaId, node.id, { kind: "simpleType" });
    }
    addChildNode(schemaId, parentId, {
      kind: "restriction",
      attributes: { base: base.trim() || "xs:string" },
    });
    toast.success("Restriction added");
  };

  return (
    <div className="mt-3 border-t pt-3">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Facets / restrictions
      </h4>
      {!hasRestriction && (
        <div className="mb-2 space-y-1.5">
          <p className="text-[10px] text-muted-foreground">
            {canCreate
              ? "No xs:restriction yet. Create one, then add facets such as minLength / maxLength."
              : "Select an element, attribute, simple type or restriction to edit facets."}
          </p>
          {canCreate && (
            <>
              <div className="grid grid-cols-[84px_1fr] items-center gap-2">
                <Label className="text-[11px] text-muted-foreground">Base</Label>
                <Input
                  value={base}
                  list="facet-base-types"
                  onChange={(e) => setBase(e.target.value)}
                  className="h-7 font-mono text-[11px]"
                />
                <datalist id="facet-base-types">
                  {XSD_BUILTIN_TYPES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <Button size="sm" variant="secondary" className="w-full" onClick={createRestriction}>
                <Plus className="size-3.5" /> Add restriction
              </Button>
            </>
          )}
        </div>
      )}
      {hasRestriction && (
      <>
      <div className="space-y-1.5">

        {facets.map((f) => (
          <div key={f.id} className="flex items-center gap-1.5">
            <span className="w-[92px] shrink-0 font-mono text-[10px] text-muted-foreground">
              {f.kind}
            </span>
            <Input
              value={edits[f.id] ?? f.value ?? ""}
              onChange={(e) => setEdits((s) => ({ ...s, [f.id]: e.target.value }))}
              className="h-7 font-mono text-[11px]"
            />
            <Button
              size="icon"
              variant="ghost"
              className="size-7 shrink-0"
              title="Save facet"
              onClick={() => {
                updateNodeProps(schemaId, f.id, { value: edits[f.id] ?? f.value ?? "" });
                toast.success(`${f.kind} updated`);
              }}
            >
              <Save className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 shrink-0 text-destructive"
              title="Remove facet"
              onClick={() => {
                deleteNode(schemaId, f.id);
                toast.success(`${f.kind} removed`);
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        {facets.length === 0 && (
          <p className="text-[11px] text-muted-foreground">No facets defined.</p>
        )}
      </div>
      <div className="mt-2 flex gap-1.5">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as XsdNodeKind)}
          className="h-7 rounded border bg-background px-1 text-[11px]"
        >
          {FACET_KINDS.map((f) => (
            <option key={f.kind} value={f.kind}>
              {f.label}
            </option>
          ))}
        </select>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="h-7 font-mono text-[11px]"
        />
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="mt-2 w-full"
        onClick={() => {
          addChildNode(schemaId, target.id, {
            kind,
            attributes: { value: value.trim() || placeholder },
          });
          setValue("");
          toast.success("Facet added");
        }}
      >
        <Plus className="size-3.5" /> Add facet
      </Button>
      </>
      )}
    </div>
  );
}

function EditorField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid grid-cols-[84px_1fr] items-center gap-2">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "—"}
        className="h-7 font-mono text-[11px]"
      />
    </div>
  );
}

function TypeField({
  label,
  value,
  onChange,
  customTypes,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  customTypes: string[];
}) {
  const listId = `types-${label.toLowerCase()}`;
  const options = Array.from(new Set([...customTypes, ...XSD_BUILTIN_TYPES]));
  return (
    <div className="grid grid-cols-[84px_1fr] items-center gap-2">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        value={value}
        list={listId}
        onChange={(e) => onChange(e.target.value)}
        placeholder="xs:string or custom…"
        className="h-7 font-mono text-[11px]"
      />
      <datalist id={listId}>
        {options.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}

function collectTypeNames(node: XsdNode, out: string[] = []): string[] {
  if ((node.kind === "complexType" || node.kind === "simpleType") && node.name) out.push(node.name);
  node.children.forEach((c) => collectTypeNames(c, out));
  return out;
}

function NodeEditor({ node, schemaId }: { node: XsdNode; schemaId: string }) {
  const schema = useStudio((s) => s.schemas).find((s) => s.id === schemaId);
  const customTypes = schema?.root
    ? Array.from(new Set(collectTypeNames(schema.root))).sort()
    : [];
  const [form, setForm] = useState({
    name: node.name ?? "",
    type: node.type ?? "",
    base: node.base ?? "",
    value: node.value ?? "",
    minOccurs: node.minOccurs ?? "",
    maxOccurs: node.maxOccurs ?? "",
    use: node.use ?? "",
    documentation: node.documentation ?? "",
  });
  const [childKind, setChildKind] = useState<XsdNodeKind>("element");
  const [childName, setChildName] = useState("");

  useEffect(() => {
    setForm({
      name: node.name ?? "",
      type: node.type ?? "",
      base: node.base ?? "",
      value: node.value ?? "",
      minOccurs: node.minOccurs ?? "",
      maxOccurs: node.maxOccurs ?? "",
      use: node.use ?? "",
      documentation: node.documentation ?? "",
    });
  }, [node]);

  const field = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const isRoot = node.kind === "schema";

  return (
    <div className="mt-4 rounded border bg-card p-2">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Edit component
      </h4>
      <div className="space-y-1.5">
        <EditorField label="Name" value={form.name} onChange={field("name")} />
        <TypeField label="Type" value={form.type} onChange={field("type")} customTypes={customTypes} />
        <TypeField label="Base" value={form.base} onChange={field("base")} customTypes={customTypes} />
        <EditorField label="Value" value={form.value} onChange={field("value")} />
        <EditorField label="minOccurs" value={form.minOccurs} onChange={field("minOccurs")} />
        <EditorField label="maxOccurs" value={form.maxOccurs} onChange={field("maxOccurs")} />
        <EditorField label="Use" value={form.use} onChange={field("use")} placeholder="optional" />
        <Textarea
          value={form.documentation}
          onChange={(e) => field("documentation")(e.target.value)}
          placeholder="Documentation…"
          className="min-h-14 text-[11px]"
        />
      </div>
      <Button
        size="sm"
        className="mt-2 w-full"
        onClick={() => {
          updateNodeProps(schemaId, node.id, form);
          toast.success("Component updated");
        }}
      >
        <Save className="size-3.5" /> Apply changes
      </Button>

      <div className="mt-3 border-t pt-3">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Add child
        </h4>
        <div className="flex gap-1.5">
          <select
            value={childKind}
            onChange={(e) => setChildKind(e.target.value as XsdNodeKind)}
            className="h-7 rounded border bg-background px-1 text-[11px]"
          >
            {ADDABLE.map((a) => (
              <option key={a.kind} value={a.kind}>
                {a.label}
              </option>
            ))}
          </select>
          <Input
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="name"
            className="h-7 font-mono text-[11px]"
          />
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="mt-2 w-full"
          onClick={() => {
            const preset = ADDABLE.find((a) => a.kind === childKind);
            const named = ["element", "attribute", "complexType", "simpleType"].includes(childKind);
            const spec = {
              kind: childKind,
              ...(named ? { name: childName.trim() || `new${childKind}` } : {}),
              attributes:
                childKind === "enumeration"
                  ? { value: childName.trim() || "NEW_VALUE" }
                  : { ...(preset?.defaults ?? {}) },
            };
            addChildNode(schemaId, node.id, spec);
            setChildName("");
            toast.success("Component added");
          }}
        >
          <Plus className="size-3.5" /> Add to {node.name ?? node.kind}
        </Button>
      </div>

      {!isRoot && <FacetEditor node={node} schemaId={schemaId} />}


      {!isRoot && (
        <Button
          size="sm"
          variant="destructive"
          className="mt-3 w-full"
          onClick={() => {
            deleteNode(schemaId, node.id);
            toast.success("Component removed");
          }}
        >
          <Trash2 className="size-3.5" /> Delete component
        </Button>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | undefined }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 border-b border-border/60 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all font-mono">{value}</span>
    </div>
  );
}

export function PropertiesPanel({
  node,
  schemaId,
}: {
  node?: XsdNode | undefined;
  schemaId?: string | undefined;
}) {
  const [draft, setDraft] = useState("");
  const comments = useStudio((s) => s.comments).filter((c) => c.target === (node?.path ?? ""));

  if (!node) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Select a component in the tree to inspect its properties.
      </div>
    );
  }

  const enums = node.children.filter((c) => c.kind === "enumeration");
  const facets = node.children.filter(
    (c) => !["enumeration", "element", "attribute", "sequence", "choice", "all"].includes(c.kind),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="overflow-y-auto p-3">
        <h3 className="font-mono text-sm font-semibold">{node.name ?? node.kind}</h3>
        <p className="mt-0.5 break-all font-mono text-[10px] text-muted-foreground">{node.path}</p>

        <div className="mt-3">
          <Row label="Kind" value={node.kind} />
          <Row label="Type" value={node.type} />
          <Row label="Base" value={node.base} />
          <Row label="Use" value={node.use} />
          <Row label="minOccurs" value={node.minOccurs} />
          <Row label="maxOccurs" value={node.maxOccurs} />
          <Row label="Line" value={String(node.line)} />
          {Object.entries(node.attributes)
            .filter(([k]) => !["name", "type", "base", "use", "minOccurs", "maxOccurs"].includes(k))
            .map(([k, v]) => (
              <Row key={k} label={`@${k}`} value={v} />
            ))}
        </div>

        {schemaId && <NodeEditor key={node.id} node={node} schemaId={schemaId} />}

        <div className="mt-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Documentation
          </h4>
          <p className="mt-1 text-xs leading-relaxed">
            {node.documentation ?? (
              <span className="text-muted-foreground">No documentation annotation.</span>
            )}
          </p>
        </div>

        {enums.length > 0 && (
          <div className="mt-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Enumerations
            </h4>
            <div className="mt-1 flex flex-wrap gap-1">
              {enums.map((e) => (
                <span
                  key={e.id}
                  className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-kind-enum"
                >
                  {e.value}
                </span>
              ))}
            </div>
          </div>
        )}

        {facets.length > 0 && (
          <div className="mt-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Restrictions &amp; structure
            </h4>
            <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
              {facets.map((f) => (
                <li key={f.id} className="text-muted-foreground">
                  {f.kind}
                  {f.value ? ` = ${f.value}` : ""}
                  {f.base ? ` (base ${f.base})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Review comments
          </h4>
          <ul className="mt-2 space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="rounded border bg-card p-2 text-xs">
                <span className="font-medium">{c.author}</span>
                <p className="mt-1 text-muted-foreground">{c.body}</p>
              </li>
            ))}
            {comments.length === 0 && (
              <li className="text-xs text-muted-foreground">No comments yet.</li>
            )}
          </ul>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment for your team…"
            className="mt-2 min-h-16 text-xs"
          />
          <Button
            size="sm"
            className="mt-2 w-full"
            disabled={!draft.trim()}
            onClick={() => {
              addComment(node.path, draft.trim());
              setDraft("");
            }}
          >
            <MessageSquarePlus className="size-3.5" /> Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
