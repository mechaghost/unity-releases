import type { ReactNode } from "react";

/**
 * Lightweight markdown renderer scoped to what Unity package
 * changelogs actually contain: headings (`#`/`##`/`###`), bullet
 * lists (`-`/`*`), numbered lists (`1.`), inline code (`` ` ``),
 * fenced code blocks (```), and inline links (`[text](url)`).
 *
 * Returns React nodes (not an HTML string) so we never have to use
 * `dangerouslySetInnerHTML` and never have to sanitize. Anything we
 * don't recognise renders as plain text - including raw HTML, which
 * is a feature, not a bug.
 *
 * `[text][ref]` reference links and full CommonMark are intentionally
 * out of scope. If a package starts shipping richer markdown we can
 * swap in `marked` + DOMPurify; today this covers what's in the DB.
 */
export function renderChangelog(input: string): ReactNode[] {
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

  return blocks.map((block, idx) => renderBlock(block, idx));
}

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string };

function renderBlock(block: Block, key: number): ReactNode {
  switch (block.kind) {
    case "heading": {
      // Demote one level so dialog/document headings (h2/h3) outrank
      // the rendered changelog (h4+). Cap at h6 - semantic deepest.
      const levelTag: keyof React.JSX.IntrinsicElements =
        (`h${Math.min(6, block.level + 3)}` as keyof React.JSX.IntrinsicElements);
      const Tag = levelTag as "h4" | "h5" | "h6";
      return (
        <Tag key={key} className="md-heading">
          {renderInline(block.text)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="md-paragraph">
          {renderInline(block.text)}
        </p>
      );
    case "ul":
      return (
        <ul key={key} className="md-list">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="md-list">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote key={key} className="md-quote">
          {renderInline(block.text)}
        </blockquote>
      );
    case "code":
      return (
        <pre key={key} className="md-code">
          <code>{block.text}</code>
        </pre>
      );
  }
}

/**
 * Inline pass: replace ``code``, [text](url), **bold**, *italic*.
 * Order matters - code first so back-tick contents aren't re-parsed.
 */
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  // We tokenize by scanning for the next match across all patterns and
  // emitting whatever plain text precedes it, then the styled token.
  const PATTERN = /(`[^`\n]+`)|(\[([^\]\n]+)\]\(([^)\s]+)\))|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)/g;

  for (let m = PATTERN.exec(text); m !== null; m = PATTERN.exec(text)) {
    if (m.index > cursor) {
      out.push(text.slice(cursor, m.index));
    }
    const [matched, codeTok, , linkText, linkUrl, boldTok, italicTok] = m;
    if (codeTok) {
      out.push(<code key={key++} className="md-inline-code">{codeTok.slice(1, -1)}</code>);
    } else if (linkText && linkUrl) {
      const safe = isSafeUrl(linkUrl);
      if (safe) {
        out.push(
          <a key={key++} href={linkUrl} target="_blank" rel="noopener noreferrer">
            {linkText}
          </a>
        );
      } else {
        // Render the original markdown for unsafe URLs - never a
        // clickable link to javascript:, file:, etc.
        out.push(matched);
      }
    } else if (boldTok) {
      out.push(<strong key={key++}>{boldTok.slice(2, -2)}</strong>);
    } else if (italicTok) {
      out.push(<em key={key++}>{italicTok.slice(1, -1)}</em>);
    }
    cursor = m.index + matched.length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function isSafeUrl(url: string): boolean {
  // Allow http(s) and protocol-relative; reject javascript:, data:, etc.
  if (url.startsWith("//")) return true;
  if (url.startsWith("/")) return true;
  return /^https?:\/\//i.test(url);
}
