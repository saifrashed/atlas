/**
 * Local folder access via the File System Access API (Chrome / Edge / Opera).
 * Everything stays in the browser — no upload, no server round-trip.
 */

export interface LocalFile {
  /** Path relative to the picked folder, e.g. "services/orders/orders.wsdl" */
  path: string;
  name: string;
  ext: "wsdl" | "xsd" | "xml" | "other";
  size: number;
  handle?: FileSystemFileHandle;
  blob?: File;
}

type DirHandle = FileSystemDirectoryHandle & {
  values: () => AsyncIterableIterator<FileSystemHandle>;
};

export function supportsLocalFolder(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

function extOf(name: string): LocalFile["ext"] {
  const m = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (m === "wsdl") return "wsdl";
  if (m === "xsd") return "xsd";
  if (m === "xml" || m === "xsl" || m === "svg" || m === "rss") return "xml";
  return "other";
}

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".idea", ".vscode"]);
const MAX_FILES = 4000;

export async function pickLocalFolder(): Promise<{ name: string; files: LocalFile[] } | undefined> {
  if (!supportsLocalFolder()) return undefined;
  const picker = (
    window as unknown as {
      showDirectoryPicker: (o?: { mode?: string }) => Promise<DirHandle>;
    }
  ).showDirectoryPicker;
  let dir: DirHandle;
  try {
    dir = await picker({ mode: "readwrite" });
  } catch (err) {
    // AbortError = user cancelled. Anything else (SecurityError in an embedded
    // frame, NotAllowedError) must bubble so callers can use the input fallback.
    if ((err as DOMException)?.name === "AbortError") return undefined;
    throw err;
  }
  const files: LocalFile[] = [];
  await scan(dir, "", files);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { name: dir.name, files };
}

async function scan(dir: DirHandle, prefix: string, out: LocalFile[]) {
  for await (const entry of dir.values()) {
    if (out.length >= MAX_FILES) return;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "directory") {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      await scan(entry as DirHandle, path, out);
      continue;
    }
    const ext = extOf(entry.name);
    if (ext === "other") continue;
    const handle = entry as FileSystemFileHandle;
    let size = 0;
    try {
      size = (await handle.getFile()).size;
    } catch {
      /* ignore unreadable entry */
    }
    out.push({ path, name: entry.name, ext, size, handle });
  }
}

export async function readLocalFile(file: LocalFile): Promise<string> {
  if (file.blob) return file.blob.text();
  if (file.handle) return (await file.handle.getFile()).text();
  return "";
}

/**
 * Fallback for browsers / embedded frames where showDirectoryPicker is
 * unavailable or blocked: build the same list from a <input webkitdirectory>.
 */
export function filesFromInput(list: FileList): { name: string; files: LocalFile[] } {
  const files: LocalFile[] = [];
  let root = "folder";
  for (const f of Array.from(list)) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const parts = rel.split("/");
    if (parts.length > 1 && parts[0]) root = parts[0];
    const path = parts.length > 1 ? parts.slice(1).join("/") : rel;
    if (parts.some((p) => SKIP_DIRS.has(p))) continue;
    const ext = extOf(f.name);
    if (ext === "other") continue;
    files.push({ path, name: f.name, ext, size: f.size, blob: f });
    if (files.length >= MAX_FILES) break;
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { name: root, files };
}

/** Resolve a relative schemaLocation against the folder-relative path of the referring file. */
export function resolvePath(fromPath: string, location: string): string {
  if (/^[a-z]+:\/\//i.test(location)) return location;
  const base = fromPath.split("/").slice(0, -1);
  for (const part of location.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") base.pop();
    else base.push(part);
  }
  return base.join("/");
}

/** Find a file in the scanned folder by resolved path, falling back to file name. */
export function findFile(files: LocalFile[], target: string): LocalFile | undefined {
  const direct = files.find((f) => f.path === target);
  if (direct) return direct;
  const base = target.split("/").pop()?.toLowerCase();
  return base ? files.find((f) => f.name.toLowerCase() === base) : undefined;
}

/* ------------------------- Writing back to disk ------------------------- */

/** True when the browser can write files back to the picked folder. */
export function supportsLocalWrite(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

async function ensureWritable(handle: FileSystemFileHandle): Promise<boolean> {
  const h = handle as FileSystemFileHandle & {
    queryPermission?: (d: { mode: string }) => Promise<PermissionState>;
    requestPermission?: (d: { mode: string }) => Promise<PermissionState>;
  };
  if (!h.queryPermission) return true;
  if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return (await h.requestPermission?.({ mode: "readwrite" })) === "granted";
}

/** Overwrite a file in the picked folder with new content. */
export async function writeLocalFile(
  handle: FileSystemFileHandle,
  content: string,
): Promise<void> {
  if (!(await ensureWritable(handle))) throw new Error("Write permission denied");
  const writable = await (
    handle as FileSystemFileHandle & { createWritable: () => Promise<FileSystemWritableFileStream> }
  ).createWritable();
  await writable.write(content);
  await writable.close();
}

/** Download a file when no writable handle is available. */
export function downloadFile(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/xml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
