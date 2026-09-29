export type LineDiffType = "added" | "removed" | "unchanged";

export interface DiffRow {
  type: LineDiffType;
  leftNumber: number | null;
  rightNumber: number | null;
  text: string;
}

/** Classic LCS line diff (Myers-free, fine for typical schema sizes). */
export function lineDiff(leftSource: string, rightSource: string): DiffRow[] {
  const a = leftSource.replace(/\r\n/g, "\n").split("\n");
  const b = rightSource.replace(/\r\n/g, "\n").split("\n");

  const n = a.length;
  const m = b.length;
  // LCS table
  const table: Uint32Array[] = Array.from(
    { length: n + 1 },
    () => new Uint32Array(m + 1),
  );
  for (let i = n - 1; i >= 0; i--) {
    const row = table[i]!;
    const next = table[i + 1]!;
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? next[j + 1]! + 1 : Math.max(next[j]!, row[j + 1]!);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: "unchanged", leftNumber: i + 1, rightNumber: j + 1, text: a[i]! });
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      rows.push({ type: "removed", leftNumber: i + 1, rightNumber: null, text: a[i]! });
      i++;
    } else {
      rows.push({ type: "added", leftNumber: null, rightNumber: j + 1, text: b[j]! });
      j++;
    }
  }
  while (i < n) {
    rows.push({ type: "removed", leftNumber: i + 1, rightNumber: null, text: a[i]! });
    i++;
  }
  while (j < m) {
    rows.push({ type: "added", leftNumber: null, rightNumber: j + 1, text: b[j]! });
    j++;
  }
  return rows;
}

export interface CollapsedBlock {
  kind: "gap";
  count: number;
}

export type DiffChunk = DiffRow | CollapsedBlock;

/** Collapse long runs of unchanged lines, keeping `context` lines around changes. */
export function collapseUnchanged(rows: DiffRow[], context = 3): DiffChunk[] {
  const keep = new Array<boolean>(rows.length).fill(false);
  rows.forEach((row, index) => {
    if (row.type === "unchanged") return;
    for (let k = Math.max(0, index - context); k <= Math.min(rows.length - 1, index + context); k++) {
      keep[k] = true;
    }
  });

  const out: DiffChunk[] = [];
  let gap = 0;
  rows.forEach((row, index) => {
    if (keep[index]) {
      if (gap > 0) {
        out.push({ kind: "gap", count: gap });
        gap = 0;
      }
      out.push(row);
    } else {
      gap++;
    }
  });
  if (gap > 0) out.push({ kind: "gap", count: gap });
  return out;
}

export function diffStats(rows: DiffRow[]) {
  let added = 0;
  let removed = 0;
  for (const row of rows) {
    if (row.type === "added") added++;
    else if (row.type === "removed") removed++;
  }
  return { added, removed };
}
