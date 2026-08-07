/**
 * Minimal reader for the React Server Components ("Flight") payload that
 * Next.js inlines into server-rendered HTML.
 *
 * WHY THIS EXISTS: the payload is JSON serialized into a JS string
 * literal, so it carries two layers of escaping - `\"` delimits a value
 * while `\\\"` is a quote inside one, and `&` stands in for `&`.
 * Successive attempts to pull fields out with regexes all failed on the
 * tail of the corpus: a title containing `&` matched the wrong
 * element entirely (resources were stored as "Text 1"), and a title
 * containing a quote truncated mid-value. A regex cannot parse a nested
 * escaping grammar - so don't. Reconstruct the stream, hand it to
 * JSON.parse, and the escaping problem disappears by construction.
 *
 * STREAM FORMAT. The HTML contains many
 *     self.__next_f.push([1,"<chunk>"])
 * calls; concatenating the decoded chunks yields the stream. A chunk
 * boundary can fall anywhere, including mid-row, so decode-then-join
 * before parsing anything. The stream is a sequence of rows:
 *     <id>:<json>\n            e.g.  6:{"seo":{...}}
 *     <id>:T<hexlen>,<text>    a length-delimited text blob
 *     <id>:I[...]              a module reference (ignored)
 * Text blobs are delimited by their DECLARED LENGTH, not by a newline -
 * the next row can begin on the same line, which is what defeated a
 * line-based split.
 *
 * REFERENCES. Long/duplicated strings are deduplicated: the field holds
 * `"$3a"` and row `3a` holds the text. resolveFlightRefs puts them back,
 * which is how a summary that used to render a literal `$3a` is now the
 * real prose.
 */

export type FlightRow = {
  id: string;
  /** "text" for `T<len>,` blobs, "json" for rows that start with { or [. */
  kind: "text" | "json" | "other";
  /** Blob text, or the raw JSON source for json/other rows. */
  body: string;
};

const PUSH_MARKER = "self.__next_f.push([1,";
const ROW_HEADER_RE = /^([0-9a-f]+):/;

/**
 * Read a JSON string literal whose opening quote is at `start`. Only one
 * escaping layer applies here (it is a plain string literal), so a
 * simple scan is exact.
 */
function readStringLiteral(source: string, start: number): string | null {
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === '"') return source.slice(start, i + 1);
    i += 1;
  }
  return null;
}

/** Concatenate every `__next_f.push([1,"…"])` chunk into the raw stream. */
export function extractFlightStream(html: string): string {
  const parts: string[] = [];
  let at = html.indexOf(PUSH_MARKER);
  while (at >= 0) {
    const quote = html.indexOf('"', at + PUSH_MARKER.length);
    if (quote < 0) break;
    const literal = readStringLiteral(html, quote);
    if (literal) {
      try {
        parts.push(JSON.parse(literal) as string);
      } catch {
        // A malformed chunk shouldn't discard the rest of the stream.
      }
    }
    at = html.indexOf(PUSH_MARKER, at + PUSH_MARKER.length);
  }
  return parts.join("");
}

/** True when `stream` has a row header at `index`. Used to confirm a
 *  text blob's declared length landed on a real boundary. */
function hasRowHeaderAt(stream: string, index: number): boolean {
  if (index >= stream.length) return true; // end of stream is a clean stop
  const rest = stream.slice(index, index + 24);
  return ROW_HEADER_RE.test(rest.startsWith("\n") ? rest.slice(1) : rest);
}

export function parseFlightRows(stream: string): Map<string, FlightRow> {
  const rows = new Map<string, FlightRow>();
  let i = 0;
  while (i < stream.length) {
    if (stream[i] === "\n") {
      i += 1;
      continue;
    }
    const header = ROW_HEADER_RE.exec(stream.slice(i, i + 24));
    if (!header) {
      const nextLine = stream.indexOf("\n", i);
      if (nextLine < 0) break;
      i = nextLine + 1;
      continue;
    }
    const id = header[1];
    let cursor = i + header[0].length;

    if (stream[cursor] === "T") {
      const comma = stream.indexOf(",", cursor);
      const hex = comma > 0 ? stream.slice(cursor + 1, comma) : "";
      const declared = /^[0-9a-f]+$/i.test(hex) ? parseInt(hex, 16) : NaN;
      if (Number.isFinite(declared)) {
        const bodyStart = comma + 1;
        let end = bodyStart + declared;
        if (!hasRowHeaderAt(stream, end)) {
          // The length is a UTF-8 byte count when the text isn't ASCII.
          const bytes = Buffer.from(stream.slice(bodyStart), "utf8");
          const byByte = bytes.subarray(0, declared).toString("utf8");
          const byteEnd = bodyStart + byByte.length;
          if (hasRowHeaderAt(stream, byteEnd)) end = byteEnd;
        }
        rows.set(id, { id, kind: "text", body: stream.slice(bodyStart, end) });
        i = end;
        continue;
      }
    }

    const lineEnd = stream.indexOf("\n", cursor);
    const body = stream.slice(cursor, lineEnd < 0 ? undefined : lineEnd);
    const head = body.trimStart()[0];
    rows.set(id, {
      id,
      kind: head === "{" || head === "[" ? "json" : "other",
      body
    });
    i = lineEnd < 0 ? stream.length : lineEnd + 1;
  }
  return rows;
}

/** `$3a` / `$L4` style pointer into another row. Flight prefixes every
 *  special value with `$`; a doubled `$$` is a literal dollar sign. */
const REF_RE = /^\$([0-9a-f]+)$/;

/**
 * Replace reference strings with the text they point at. Depth-limited
 * and cycle-safe; an unresolvable reference becomes null rather than
 * leaking a `$3a` token into the database.
 */
export function resolveFlightRefs(
  value: unknown,
  rows: Map<string, FlightRow>,
  seen: Set<string> = new Set(),
  depth = 0
): unknown {
  if (depth > 12) return value;
  if (typeof value === "string") {
    if (value.startsWith("$$")) return value.slice(1); // escaped literal `$`
    const ref = REF_RE.exec(value);
    if (!ref) return value;
    const id = ref[1];
    if (seen.has(id)) return null;
    const row = rows.get(id);
    if (!row) return null;
    if (row.kind === "text") return row.body;
    if (row.kind === "json") {
      try {
        const next = new Set(seen);
        next.add(id);
        return resolveFlightRefs(JSON.parse(row.body), rows, next, depth + 1);
      } catch {
        return null;
      }
    }
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveFlightRefs(v, rows, seen, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveFlightRefs(v, rows, seen, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * First object anywhere in the parsed rows that satisfies `predicate`,
 * with its references resolved. Rows are scanned in stream order.
 */
export function findFlightObject(
  rows: Map<string, FlightRow>,
  predicate: (node: Record<string, unknown>) => boolean
): Record<string, unknown> | null {
  for (const row of rows.values()) {
    if (row.kind !== "json") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.body);
    } catch {
      continue;
    }
    const hit = deepFind(parsed, predicate, 0);
    if (hit) {
      return resolveFlightRefs(hit, rows) as Record<string, unknown>;
    }
  }
  return null;
}

function deepFind(
  node: unknown,
  predicate: (node: Record<string, unknown>) => boolean,
  depth: number
): Record<string, unknown> | null {
  if (depth > 40 || node === null || typeof node !== "object") return null;
  if (!Array.isArray(node) && predicate(node as Record<string, unknown>)) {
    return node as Record<string, unknown>;
  }
  for (const child of Array.isArray(node) ? node : Object.values(node)) {
    const hit = deepFind(child, predicate, depth + 1);
    if (hit) return hit;
  }
  return null;
}
