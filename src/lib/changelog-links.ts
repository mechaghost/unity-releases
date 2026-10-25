import { resolveExternalLink } from "./external-links";

export function parseChangelog(input: string): Block[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      i += 1;
      continue;
    }

    // Fenced code block - gobble until the closing fence (or EOF).
    const fenceMatch = /^```(.*)$/.exec(trimmed);
    if (fenceMatch) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i += 1;
      }
      // Skip the closing fence if present.
      if (i < lines.length) i += 1;
      blocks.push({ kind: "code", text: buf.join("\n") });
      continue;
    }

    // Heading - 1 to 6 leading hashes.
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      blocks.push({
        kind: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim()
      });
      i += 1;
      continue;
    }

    // Unordered list - every consecutive line starting with `- ` or `* `.
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (t === "") break;
        const m = /^[-*]\s+(.*)$/.exec(t);
        if (!m) {
          // Continuation line - append to the previous item with a space
          // separator so wrapped bullet text doesn't split into a new
          // paragraph.
          if (items.length > 0) items[items.length - 1] += " " + t;
          else break;
        } else {
          items.push(m[1]);
        }
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // Ordered list - every consecutive line starting with `<n>. `.
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (t === "") break;
        const m = /^\d+\.\s+(.*)$/.exec(t);
        if (!m) {
          if (items.length > 0) items[items.length - 1] += " " + t;
          else break;
        } else {
          items.push(m[1]);
        }
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Blockquote - every consecutive line starting with `>`.
    if (/^>\s?/.test(trimmed)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ kind: "quote", text: buf.join(" ") });
      continue;
    }

    // Paragraph - every consecutive non-blank, non-special line.
    const buf: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (t === "") break;
      if (
        /^#{1,6}\s+/.test(t) ||
        /^[-*]\s+/.test(t) ||
        /^\d+\.\s+/.test(t) ||
        /^>\s?/.test(t) ||
        /^```/.test(t)
      ) {
        break;
      }
      buf.push(t);
      i += 1;
    }
    blocks.push({ kind: "paragraph", text: buf.join(" ") });
  }

  return blocks;
}

export type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string };

export function changelogInlineMatches(text: string): IterableIterator<RegExpMatchArray> {
  // Code is matched first so link-looking examples in inline code stay text.
  const pattern = /(`[^`\n]+`)|(\[([^\]\n]+)\]\(([^)\s]+)\))|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)/g;
  return text.matchAll(pattern);
}

export function changelogLinks(input: string): string[] {
  const links: string[] = [];
  for (const block of parseChangelog(input)) {
    if (block.kind === "code") continue;
    const texts = "items" in block ? block.items : [block.text];
    for (const text of texts) {
      for (const match of changelogInlineMatches(text)) {
        const href = match[4];
        if (!href || !isSafeChangelogUrl(href)) continue;
        const resolved = resolveExternalLink(href);
        if (resolved.href) links.push(resolved.href);
      }
    }
  }
  return links;
}

export function isSafeChangelogUrl(url: string): boolean {
  // Allow http(s) and protocol-relative; reject javascript:, data:, etc.
  if (url.startsWith("//")) return true;
  if (url.startsWith("/")) return true;
  return /^https?:\/\//i.test(url);
}
