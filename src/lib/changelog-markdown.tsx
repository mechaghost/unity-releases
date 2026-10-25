import type { ReactNode } from "react";
import { ExternalLink } from "@/app/_components/ExternalLink";
import { parseChangelog, changelogInlineMatches, isSafeChangelogUrl, type Block } from "./changelog-links";

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
  return parseChangelog(input).map((block, idx) => renderBlock(block, idx));
}

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
  for (const m of changelogInlineMatches(text)) {
    const index = m.index ?? 0;
    if (index > cursor) {
      out.push(text.slice(cursor, index));
    }
    const [matched, codeTok, , linkText, linkUrl, boldTok, italicTok] = m;
    if (codeTok) {
      out.push(<code key={key++} className="md-inline-code">{codeTok.slice(1, -1)}</code>);
    } else if (linkText && linkUrl) {
      const safe = isSafeChangelogUrl(linkUrl);
      if (safe) {
        out.push(
          <ExternalLink key={key++} href={linkUrl}>
            {linkText}
          </ExternalLink>
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
    cursor = index + matched.length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}
