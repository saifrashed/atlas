import { useSyncExternalStore } from "react";
import { parseXsd } from "./xsd/parser";
import { SAMPLES } from "./xsd/samples";
import {
  createNode,
  recomputePaths,
  serializeSchema,
  FIELD_ATTRS,
  type EditableField,
  type NewNodeSpec,
} from "./xsd/serialize";
import type { ParsedSchema, XsdNode } from "./xsd/types";
import { writeLocalFile, downloadFile, type LocalFile } from "./fs/localFolder";
import type { ParsedWsdl } from "./wsdl/parse";

export interface WsdlEntry {
  file: LocalFile;
  parsed: ParsedWsdl;
  links: { label: string; target: string; file?: LocalFile | undefined }[];
}

/** What the Local folder screen has open, kept so the tab remembers it. */
export interface FolderSession {
  folder?: string | undefined;
  files: LocalFile[];
  wsdls: WsdlEntry[];
  activeWsdl?: string | undefined;
  query: string;
}

export interface Comment {
  id: string;
  target: string;
  author: string;
  body: string;
  createdAt: number;
}

interface StudioState {
  schemas: ParsedSchema[];
  activeId?: string | undefined;
  compareLeftId?: string | undefined;
  compareRightId?: string | undefined;
  resolved: Record<string, boolean>;
  comments: Comment[];
  theme: "dark" | "light";
  explorerMode: "xsd" | "xml";
  /** XML documents handed to the Explorer from other screens (e.g. local folder). */
  xmlFiles: { fileName: string; content: string }[];
  /** Write edits straight back to the file in the picked local folder. */
  autoSave: boolean;
  /** Per-schema save state shown in the toolbar. */
  saveStatus: Record<string, { state: "saved" | "saving" | "error" | "unlinked"; at?: number; message?: string }>;
  /** Remembered state of the Local folder screen. */
  folderSession: FolderSession;
}

let state: StudioState = {
  schemas: [],
  resolved: {},
  comments: [],
  theme: "dark",
  explorerMode: "xsd",
  xmlFiles: [],
  autoSave: true,
  saveStatus: {},
  folderSession: { files: [], wsdls: [], query: "" },
};

export const setFolderSession = (patch: Partial<FolderSession>) =>
  set({ folderSession: { ...state.folderSession, ...patch } });

/** schemaId -> writable handle of the file it was opened from. */
const fileHandles = new Map<string, FileSystemFileHandle>();

export const setAutoSave = (autoSave: boolean) => set({ autoSave });

export function linkSchemaToFile(schemaId: string, handle?: FileSystemFileHandle) {
  if (handle) fileHandles.set(schemaId, handle);
  set({
    saveStatus: {
      ...state.saveStatus,
      [schemaId]: { state: handle ? "saved" : "unlinked" },
    },
  });
}

export const isSchemaLinked = (schemaId: string) => fileHandles.has(schemaId);

const setStatus = (id: string, status: StudioState["saveStatus"][string]) =>
  set({ saveStatus: { ...state.saveStatus, [id]: status } });

/** Write the current source of a schema back to its file on disk. */
export async function saveSchemaToDisk(schemaId: string, opts?: { manual?: boolean }) {
  const schema = state.schemas.find((s) => s.id === schemaId);
  if (!schema) return;
  const handle = fileHandles.get(schemaId);
  if (!handle) {
    if (opts?.manual) downloadFile(schema.fileName, schema.content);
    else setStatus(schemaId, { state: "unlinked" });
    return;
  }
  setStatus(schemaId, { state: "saving" });
  try {
    await writeLocalFile(handle, schema.content);
    setStatus(schemaId, { state: "saved", at: Date.now() });
  } catch (err) {
    setStatus(schemaId, {
      state: "error",
      message: err instanceof Error ? err.message : "Could not write the file",
    });
  }
}


const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<StudioState>) => {
  state = { ...state, ...patch };
  emit();
};

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getState = () => state;
const getServerState = () => state;

export function useStudio<T>(select: (s: StudioState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(getServerState()),
  );
}

export function addSchemas(files: { fileName: string; content: string }[]) {
  const parsed = files.map((f) => parseXsd(f.fileName, f.content));
  const schemas = [...state.schemas, ...parsed];
  set({
    schemas,
    activeId: state.activeId ?? parsed[0]?.id,
    compareLeftId: state.compareLeftId ?? schemas[0]?.id,
    compareRightId: state.compareRightId ?? schemas[1]?.id ?? schemas[0]?.id,
  });
  return parsed;
}

export function loadSamples() {
  if (state.schemas.some((s) => SAMPLES.some((x) => x.fileName === s.fileName))) return;
  addSchemas(SAMPLES);
}

/** Start a brand-new schema from scratch (no upload needed). */
export function createBlankSchema(fileName?: string, targetNamespace?: string) {
  const n = state.schemas.length + 1;
  const name = (fileName?.trim() || `untitled-${n}.xsd`).replace(/(\.xsd)?$/i, ".xsd");
  const ns = targetNamespace?.trim();
  const nsAttrs = ns
    ? `\n            targetNamespace="${ns}"\n            xmlns:tns="${ns}"\n            elementFormDefault="qualified"`
    : `\n            elementFormDefault="qualified"`;
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"${nsAttrs}>
  <xs:element name="Root">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="Item" type="xs:string"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>
`;
  const [schema] = addSchemas([{ fileName: name, content }]);
  if (schema) {
    set({ activeId: schema.id, explorerMode: "xsd" });
    linkSchemaToFile(schema.id);
  }
  return schema;
}


export function removeSchema(id: string) {
  const schemas = state.schemas.filter((s) => s.id !== id);
  set({
    schemas,
    activeId: state.activeId === id ? schemas[0]?.id : state.activeId,
    compareLeftId: state.compareLeftId === id ? schemas[0]?.id : state.compareLeftId,
    compareRightId: state.compareRightId === id ? schemas[1]?.id : state.compareRightId,
  });
}

export const setActive = (id: string) => set({ activeId: id });
export const setCompare = (side: "left" | "right", id: string) =>
  set(side === "left" ? { compareLeftId: id } : { compareRightId: id });

export const setExplorerMode = (explorerMode: "xsd" | "xml") => set({ explorerMode });

/** Open an XML document in the Explorer's XML mode. */
export function openXmlFile(fileName: string, content: string) {
  set({ xmlFiles: [...state.xmlFiles, { fileName, content }], explorerMode: "xml" });
}

/** Add schema files (from the local folder browser) and focus the first one. */
export function openSchemaFiles(
  files: { fileName: string; content: string; handle?: FileSystemFileHandle | undefined }[],
) {
  const parsed = addSchemas(files.map((f) => ({ fileName: f.fileName, content: f.content })));
  parsed.forEach((schema, i) => linkSchemaToFile(schema.id, files[i]?.handle));
  set({ activeId: parsed[0]?.id ?? state.activeId, explorerMode: "xsd" });
  return parsed;
}

export const toggleResolved = (findingKey: string) =>
  set({ resolved: { ...state.resolved, [findingKey]: !state.resolved[findingKey] } });


export function addComment(target: string, body: string) {
  const comment: Comment = {
    id: `c-${Date.now()}`,
    target,
    author: "You",
    body,
    createdAt: Date.now(),
  };
  set({ comments: [...state.comments, comment] });
}

const THEME_KEY = "atlas-theme";

export function setTheme(theme: "dark" | "light") {
  set({ theme });
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function initTheme() {
  if (typeof document === "undefined") return;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    /* ignore */
  }
  const theme = saved === "light" || saved === "dark" ? saved : "dark";
  if (state.theme !== theme || !document.documentElement.classList.contains("dark") === (theme === "dark")) {
    setTheme(theme);
  }
}


export function activeSchema() {
  return state.schemas.find((s) => s.id === state.activeId);
}

/* ----------------------------- Visual editing ----------------------------- */

function cloneNode(node: XsdNode): XsdNode {
  return {
    ...node,
    attributes: { ...node.attributes },
    children: node.children.map(cloneNode),
  };
}

function computeStats(node: XsdNode, acc: ParsedSchema["stats"]) {
  if (node.kind === "element" && node.name) acc.elements += 1;
  if (node.kind === "complexType") acc.complexTypes += 1;
  if (node.kind === "simpleType") acc.simpleTypes += 1;
  if (node.kind === "attribute") acc.attributes += 1;
  if (node.kind === "enumeration") acc.enumerations += 1;
  node.children.forEach((c) => computeStats(c, acc));
}

function findNode(node: XsdNode, id: string): XsdNode | undefined {
  if (node.id === id) return node;
  for (const child of node.children) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return undefined;
}

function findParent(node: XsdNode, id: string): XsdNode | undefined {
  for (const child of node.children) {
    if (child.id === id) return node;
    const hit = findParent(child, id);
    if (hit) return hit;
  }
  return undefined;
}

/** Apply a mutation to the active schema tree and regenerate source + stats. */
function editSchema(schemaId: string, mutate: (root: XsdNode) => void) {
  const index = state.schemas.findIndex((s) => s.id === schemaId);
  const current = state.schemas[index];
  if (!current?.root) return;

  const root = cloneNode(current.root);
  mutate(root);
  recomputePaths(root);

  const stats = {
    elements: 0,
    complexTypes: 0,
    simpleTypes: 0,
    attributes: 0,
    enumerations: 0,
  };
  computeStats(root, stats);

  const next: ParsedSchema = { ...current, root, stats };
  next.content = serializeSchema(next);
  next.size = new Blob([next.content]).size;

  const schemas = [...state.schemas];
  schemas[index] = next;
  set({ schemas });

  if (state.autoSave) void saveSchemaToDisk(schemaId);
}

export function updateNodeProps(
  schemaId: string,
  nodeId: string,
  patch: Partial<Record<EditableField, string>> & { documentation?: string },
) {
  editSchema(schemaId, (root) => {
    const node = findNode(root, nodeId);
    if (!node) return;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "documentation") {
        node.documentation = value?.trim() ? value : undefined;
        continue;
      }
      const field = key as EditableField;
      const attrName = FIELD_ATTRS[field];
      if (value === undefined || value === "") {
        delete node.attributes[attrName];
        node[field] = undefined;
      } else {
        node.attributes[attrName] = value;
        node[field] = value;
      }
    }
  });
}

export function addChildNode(schemaId: string, parentId: string, spec: NewNodeSpec) {
  const child = createNode(spec);
  editSchema(schemaId, (root) => {
    const parent = findNode(root, parentId);
    if (!parent) return;
    parent.children.push(child);
  });
  return child.id;
}

/** Rename a schema file (title) and optionally its target namespace. */
export function renameSchema(schemaId: string, fileName: string, targetNamespace?: string) {
  const index = state.schemas.findIndex((s) => s.id === schemaId);
  const current = state.schemas[index];
  if (!current) return;
  const name = (fileName.trim() || current.fileName).replace(/(\.xsd)?$/i, ".xsd");
  const ns = targetNamespace?.trim();
  const next = { ...current, fileName: name, targetNamespace: ns || undefined };
  if (next.root) {
    const root = cloneNode(next.root);
    if (ns) {
      root.attributes["targetNamespace"] = ns;
      root.attributes["xmlns:tns"] = ns;
    } else {
      delete root.attributes["targetNamespace"];
      delete root.attributes["xmlns:tns"];
    }
    next.root = root;
    next.content = serializeSchema(next);
    next.size = new Blob([next.content]).size;
  }
  const schemas = [...state.schemas];
  schemas[index] = next;
  set({ schemas });
  if (state.autoSave) void saveSchemaToDisk(schemaId);
}

/** Replace the raw XSD source, re-parse it and refresh tree/diagram/validation. */
export function updateSchemaSource(schemaId: string, content: string) {
  const index = state.schemas.findIndex((s) => s.id === schemaId);
  const current = state.schemas[index];
  if (!current) return;
  const reparsed = parseXsd(current.fileName, content);
  const next: ParsedSchema = { ...reparsed, id: current.id };
  const schemas = [...state.schemas];
  schemas[index] = next;
  set({ schemas });
  if (state.autoSave) void saveSchemaToDisk(schemaId);
}

export function deleteNode(schemaId: string, nodeId: string) {

  editSchema(schemaId, (root) => {
    const parent = findParent(root, nodeId);
    if (!parent) return;
    parent.children = parent.children.filter((c) => c.id !== nodeId);
  });
}
