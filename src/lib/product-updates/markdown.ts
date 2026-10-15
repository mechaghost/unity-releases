import { marked } from "marked";

/**
 * docs.unity.com went client-rendered: its HTML shell now carries zero
 * `h1`/`h2`/`h3` elements, and the article body only survives inside a
 * React Flight payload as *compiled MDX JavaScript*
 * (`_jsx(_components.li, …)`) - source code, not serialised data, so the
 * Flight decoder in `src/lib/ingest/rsc-flight.ts` can't recover it and
 * a regex over compiled JSX would be exactly the pattern-matching that
 * CLAUDE.md forbids.
 *
 * Every affected page does publish a markdown twin at `<url>.md`
 * (`text/markdown`), whose `#`/`##`/`###` + list structure maps onto the
 * same DOM shape the adapters were already written against. So we render
 * that markdown to HTML here and hand it to the existing parsers
 * unchanged - the site's rewrite costs us one conversion step instead of
 * twelve rewritten adapters.
 *
 * The raw markdown is what gets stored as the snapshot, so evidence stays
 * verbatim and a replay re-runs this conversion rather than trusting a
 * derived artefact.
 */
/**
 * Fold Unity's multi-line table cells back into single-line GFM rows.
 *
 * GFM has no syntax for a multi-line cell, so the docs exporter emits
 * the first line of a Notes cell inside the row and dumps the rest -
 * bullets, nested bullets, blank lines, run-on prose - as bare lines
 * after it, until the next `|` row. marked closes the table at the first
 * of those lines, so LevelPlay kept 1 of ~60 rows and Unity Ads lost
 * every platform row that followed a multi-line cell. The three
 * validation floors caught it: "returned 1 record; expected 15" and
 * "count dropped 52.3%".
 *
 * Grammar, taken from the real exports (levelplay/sdk/<platform>/changelog,
 * grow/ads/changelog): a table starts at a header row followed by a
 * delimiter row; every later line that starts with `|` is a new row;
 * anything else belongs to the current row's last cell until a heading
 * or end of document. Rows carry no closing pipe. Bullet markers are
 * stripped and lines joined by spaces, which is what `.text()` on the
 * old rendered <td><ul><li> gave the parsers, so item bodies and keys
 * stay stable. A literal `|` inside a folded line is escaped so it can't
 * split the cell.
 */
export function repairUnityDocsTables(markdown: string): string {
  const out: string[] = [];
  let inTable = false;
  let columnCount = 0;
  let row: string | null = null;
  const flush = () => {
    if (row !== null) out.push(row.trimEnd() + " |");
    row = null;
  };
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const isPipe = line.startsWith("|");
    const isDelimiter = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line);
    if (!inTable) {
      // A header row immediately followed by a delimiter row opens a table.
      if (isPipe && i + 1 < lines.length && /^\|?\s*:?-+:?\s*(\||$)/.test(lines[i + 1])) {
        inTable = true;
        columnCount = countColumns(line);
        out.push(line);
        out.push(lines[i + 1]);
        i += 1;
        continue;
      }
      out.push(line);
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flush();
      inTable = false;
      out.push(line);
      continue;
    }
    if (isDelimiter) continue; // a stray delimiter never belongs in a cell
    if (isPipe) {
      flush();
      row = normalizeRow(line, columnCount);
      continue;
    }
    // The exporter may close the row on its final continuation line.
    // Remove that delimiter before escaping content pipes, or it leaves a
    // literal backslash in the rendered note.
    const folded = stripOuterPipes(line).replace(/^\s*(?:[*+-]|\d+\.)\s+/, "").trim();
    if (!folded) continue;
    if (row === null) {
      // Prose before the first data row - not part of any cell.
      out.push(line);
      continue;
    }
    row = `${row.trimEnd()} ${folded.split("|").join(ESCAPED_PIPE)}`;
  }
  flush();
  return out.join("\n");
}

/** `\|` - a pipe escaped for a GFM cell. Built from a char code so this
 *  file carries no backslash literals: three separate write-throughs mangled
 *  them, and a lookbehind that loses one backslash is a silent no-op. */
const ESCAPED_PIPE = String.fromCharCode(92) + "|";

/** Number of cells in a GFM header row, ignoring a leading/trailing pipe. */
function countColumns(header: string): number {
  return stripOuterPipes(header).split("|").length;
}

/** Drop a leading pipe and an unescaped trailing pipe. */
function stripOuterPipes(line: string): string {
  let body = line.startsWith("|") ? line.slice(1) : line;
  const trimmed = body.trimEnd();
  if (trimmed.endsWith("|") && !trimmed.endsWith(ESCAPED_PIPE)) {
    body = trimmed.slice(0, -1);
  }
  return body;
}

/**
 * Rebuild one data row so it has exactly the header's column count.
 *
 * The header fixes how many `|` separators a row may have; any pipe past
 * the last one is *content* of the last cell (a code span like
 * `Foo|Bar`) and must be escaped, or marked splits the cell and shifts
 * the version/date columns. The last cell's leading bullet marker is
 * dropped too - the row's own first note line carries one - so the cell
 * reads like the old rendered <td> text.
 */
function normalizeRow(line: string, columnCount: number): string {
  const parts = stripOuterPipes(line).split("|");
  const keep = Math.max(columnCount - 1, 0);
  const head = parts.slice(0, keep);
  const last = parts
    .slice(keep)
    .join(ESCAPED_PIPE)
    .replace(/^\s*(?:[*+-]|\d+\.)\s+/, " ");
  return `|${[...head, last].join("|")}`;
}

export function markdownToHtml(markdown: string): string {
  const html = marked.parse(repairUnityDocsTables(markdown), {
    async: false,
    // GFM keeps tables and strikethrough, which several changelogs use.
    gfm: true,
    // Unity's markdown uses hard line breaks inside list items purely for
    // source wrapping; treating them as <br> would split sentences mid-item.
    breaks: false
  }) as string;
  // The adapters navigate with sibling selectors (`prevAll("h2")`,
  // `nextUntil("h2,h3")`) and expect one common parent, which marked's
  // flat top-level output gives them once wrapped.
  return `<div data-unity-docs-markdown="1">${html}</div>`;
}
