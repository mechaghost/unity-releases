import { query } from "./db/client";
import {
  listDiscoursePosts,
  listLatestBlogPosts,
  listGithubRepos,
  listResources,
  numericVersionDesc
} from "./db/repositories";
import { getNewestIssues } from "./issues";
import { listProductUpdates, productUpdatesSchemaReady } from "./product-updates/repositories";
import { marked, type Token } from "marked";
import { cleanReleaseNoteText } from "./release-notes/format";
import { streamLabel } from "./stream-labels";
import { modernMajorSql } from "./unity-generation";

export type LatestUpdateKey =
  | "releases" | "packages" | "editor-tools" | "products" | "issues"
  | "news" | "resources" | "discussions" | "github";

export type LatestUpdateState = {
  item: { title: string; date: string | null; dateLabel?: "Updated" | "First noted"; summary?: string } | null;
  unavailable: boolean;
};

type Item = NonNullable<LatestUpdateState["item"]>;
const EMPTY: LatestUpdateState = { item: null, unavailable: false };

/** Dates describe upstream content, never our polling or discovery time. */
function item(title: string, date: string | Date | null | undefined, dateLabel?: "Updated" | "First noted"): Item {
  const parsed = date ? new Date(date) : null;
  return {
    title: title.replace(/\s+/g, " ").trim(),
    date: parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null,
    ...(dateLabel ? { dateLabel } : {})
  };
}

async function safely(load: () => Promise<Item | null>): Promise<LatestUpdateState> {
  try {
    return { item: await load(), unavailable: false };
  } catch {
    return { item: null, unavailable: true };
  }
}

function inlineText(token: Token): string {
  if (token.type === "html") return "";
  if ("tokens" in token && Array.isArray(token.tokens)) return token.tokens.map(inlineText).join("");
  return "text" in token && typeof token.text === "string" ? token.text : token.raw;
}

function summary(body: string | null | undefined): string | undefined {
  if (!body) return undefined;
  const text = cleanReleaseNoteText(marked.Lexer.lexInline(body).map(inlineText).join(""));
  if (!text) return undefined;
  if (text.length <= 180) return text;
  const cut = text.slice(0, 179);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 120 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

function packageSummary(changelog: string | null | undefined): string | undefined {
  if (!changelog) return undefined;
  for (const token of marked.lexer(changelog)) {
    if (token.type !== "list") continue;
    for (const entry of token.items) {
      const text = summary(entry.text);
      if (text) return text;
    }
  }
  return undefined;
}

async function latestRelease(): Promise<Item | null> {
  const result = await query<{ version: string; stream: string; release_date: string | null; summary: string | null }>(`
    WITH latest AS (
      SELECT id, version, stream, release_date
      FROM unity_releases
      WHERE stream IN ('LTS', 'Update/Supported')
        AND (stream <> 'LTS' OR ${modernMajorSql("version")} OR NOT EXISTS (
          SELECT 1 FROM unity_releases modern_lts
          WHERE modern_lts.stream = 'LTS' AND ${modernMajorSql("modern_lts.version")}
        ))
      ORDER BY release_date DESC NULLS LAST, ${numericVersionDesc("version")}
      LIMIT 1
    )
    SELECT r.version, r.stream, r.release_date, note.body AS summary
    FROM latest r
    LEFT JOIN LATERAL (
      SELECT body FROM release_note_items
      WHERE unity_release_id = r.id AND section IN ('Features', 'Improvements', 'Fixes')
      ORDER BY CASE section WHEN 'Features' THEN 0 WHEN 'Improvements' THEN 1 ELSE 2 END,
               source_order ASC, id ASC
      LIMIT 1
    ) note ON true
  `);
  const row = result.rows[0];
  return row ? { ...item(`Unity ${row.version} · ${streamLabel(row.stream)}`, row.release_date), summary: summary(row.summary) } : null;
}

async function latestPackage(): Promise<Item | null> {
  const result = await query<{ name: string; version: string; published_at: string | null; is_prerelease: boolean; changelog: string | null }>(`
    SELECT COALESCE(p.display_name, p.name) AS name,
           pv.version, pv.published_at, pv.is_prerelease, pv.changelog
    FROM packages p
    JOIN LATERAL (
      SELECT version, published_at, is_prerelease, changelog
      FROM package_versions WHERE package_id = p.id
      ORDER BY published_at DESC NULLS LAST, version DESC
      LIMIT 1
    ) pv ON true
    ORDER BY pv.published_at DESC NULLS LAST, LOWER(COALESCE(p.display_name, p.name)) ASC, p.name ASC
    LIMIT 1
  `);
  const row = result.rows[0];
  return row ? {
    ...item(`${row.name} ${row.version}${row.is_prerelease ? " · Prerelease" : ""}`, row.published_at),
    summary: packageSummary(row.changelog)
  } : null;
}

async function latestProduct(family?: string): Promise<Item | null> {
  if (!(await productUpdatesSchemaReady())) throw new Error("Product updates unavailable");
  const [row] = await listProductUpdates({ family, limit: 1 });
  if (!row) return null;
  const title = row.title.toLowerCase().includes(row.productName.toLowerCase())
    ? row.title
    : `${row.productName}: ${row.title}`;
  const change = await query<{ body: string }>(`
    SELECT change.body
    FROM product_update_observation_items change
    JOIN product_update_observations observation ON observation.id = change.observation_id
    WHERE observation.product_update_id = $1
      AND change.change_kind NOT IN ('known-issue', 'known_issue')
      AND change.section !~* 'known[ -]?issues?|limitations?'
      AND btrim(change.body) <> ''
      AND btrim(change.body) !~* '^(none|n/a|not applicable|no changes?)[.!]?$'
    ORDER BY CASE change.change_kind
      WHEN 'feature' THEN 0 WHEN 'improvement' THEN 1 WHEN 'fix' THEN 2 ELSE 3 END,
      observation.published_at DESC NULLS LAST, observation.id ASC,
      change.source_order ASC, change.id ASC
    LIMIT 1
  `, [row.id]);
  const sourceSummary = summary(row.summary);
  const meaningfulSummary = sourceSummary && !/^[\d,]+ documented changes?(?: across [\d,]+ sections?)?\.?$/i.test(sourceSummary)
    ? sourceSummary
    : undefined;
  // sortTime can be first_seen_at for undated records: do not call it a release date.
  return { ...item(title, row.releaseDate), summary: summary(change.rows[0]?.body) ?? meaningfulSummary };
}

/** A failed source must not hide fresh content from the other sections. */
export async function getLatestUpdates(productsEnabled: boolean): Promise<Record<LatestUpdateKey, LatestUpdateState>> {
  const loaders: Record<LatestUpdateKey, () => Promise<Item | null>> = {
    releases: latestRelease,
    packages: latestPackage,
    "editor-tools": () => latestProduct("editor-tooling"),
    products: () => latestProduct(),
    issues: async () => {
      const [row] = await getNewestIssues(1);
      return row ? item(`${row.issueId}${row.description ? `: ${row.description.split("\n")[0]}` : ""}`, row.introducedDate, "First noted") : null;
    },
    news: async () => {
      const [row] = await listLatestBlogPosts(1);
      return row ? item(row.title, row.published_at) : null;
    },
    resources: async () => {
      const { rows: [row] } = await listResources({ limit: 1 });
      return row ? item(row.title, row.resource_date) : null;
    },
    discussions: async () => {
      const { items: [row] } = await listDiscoursePosts({ firstPostOnly: true, sort: "recent", perPage: 1 });
      return row ? item(row.topicTitle ?? `Post by ${row.username}`, row.discourseUpdatedAt, "Updated") : null;
    },
    github: async () => {
      const { items: [row] } = await listGithubRepos({ sort: "updated", direction: "desc", perPage: 1 });
      return row ? item(row.latestCommitMessage ? `${row.name}: ${row.latestCommitMessage.split("\n")[0]}` : row.name, row.repoPushedAt, "Updated") : null;
    }
  };
  const entries = await Promise.all((Object.keys(loaders) as LatestUpdateKey[]).map(async (key) => {
    if (!productsEnabled && (key === "editor-tools" || key === "products")) return [key, { ...EMPTY }] as const;
    return [key, await safely(loaders[key])] as const;
  }));
  return Object.fromEntries(entries) as Record<LatestUpdateKey, LatestUpdateState>;
}
