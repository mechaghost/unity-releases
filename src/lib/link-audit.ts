import { load } from 'cheerio';
import { changelogLinks } from './changelog-links';

export type AuditResponse = { status: number; finalUrl: string; contentType: string; body: string };
export type AuditResult = {
  url: string; result: 'reachable' | 'broken' | 'blocked' | 'unverified';
  status?: number; finalUrl?: string; reason?: string; references: string[];
};
export type AuditOptions = {
  origin: string; seeds?: string[]; maxPages?: number; externalLimit?: number;
  sampleIndex?: number; delayMs?: number; fetchPage?: (url: string) => Promise<AuditResponse>;
  onProgress?: (checked: number) => void;
  budgetMs?: number; now?: () => number; signal?: AbortSignal;
  resume?: AuditCheckpoint;
  onCheckpoint?: (state: AuditCheckpoint) => Promise<void>;
};
export type AuditCheckpoint = {
  version: 1; origin: string; startedAt: string; sampleIndex: number;
  queue: string[]; index: number; external: string[]; externalChecked: string[];
  references: [string, string[]][]; ids: [string, string[]][];
  fragments: [string, { target: string; hash: string; reference: string }][];
  results: AuditResult[]; blockedHosts: string[]; complete: boolean;
};
const EXTERNAL_DOMAINS = ['unity.com', 'unity3d.com', 'github.com', 'githubusercontent.com', 'storage.googleapis.com', 'developer.android.com', 'learn.microsoft.com', 'developer.apple.com', 'khronos.org'];

export function classifyLink(response: AuditResponse): AuditResult['result'] {
  if (response.status === 403 || response.status === 429) return 'blocked';
  if (response.status >= 400) return 'broken';
  const destination = new URL(response.finalUrl);
  // Unity issue 404 is a real numeric ID (UUM-10786), with an optional slug.
  // Only exempt that route from the path heuristic; HTTP and HTML errors still fail.
  const numericIssue404 = ['issuetracker.unity.com', 'issuetracker.unity3d.com'].includes(destination.hostname)
    && /^\/issues\/404(?:\/[^/]+)?\/?$/.test(destination.pathname);
  if (/(?:^|\/)not-found(?:\/|$)/i.test(destination.pathname)
    || (!numericIssue404 && /(?:^|\/)404(?:\/|$)/i.test(destination.pathname))) return 'broken';
  if (response.contentType.includes('html')) {
    const $ = load(response.body);
    const title = $('head > title').text().trim();
    if (/^(?:404\b|page not found\b|unity issue tracker - page not found\b|page not found · github)/i.test(title)) return 'broken';
    if (/Application error: a (?:server|client)-side exception/i.test($('body').text())) return 'broken';
  }
  return 'reachable';
}

function normalizedUrl(href: string, base: string): string | null {
  try {
    const url = new URL(href, base);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
function allowedExternal(url: string) {
  const host = new URL(url).hostname;
  return EXTERNAL_DOMAINS.some(domain => host === domain || host.endsWith('.' + domain));
}

/** GET-only, bounded checks. Never retries a blocked host in the same run. */
export async function fetchAuditPage(url: string, fetchImpl: typeof fetch = fetch, outerSignal?: AbortSignal): Promise<AuditResponse> {
  let current = url;
  let response: Response | undefined;
  const initialOrigin = new URL(url).origin;
  const signal = AbortSignal.any([AbortSignal.timeout(20_000), ...(outerSignal ? [outerSignal] : [])]);
  for (let hop = 0; hop <= 8; hop++) {
    response = await fetchImpl(current, {
      signal, redirect: 'manual',
      headers: { 'user-agent': 'UnityReleasesLinkCheck/1.0 (+https://unityreleases.com/faq)' }
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    await response.body?.cancel();
    if (hop === 8) throw new Error('Redirect limit exceeded');
    const location = response.headers.get('location');
    const next = location ? normalizedUrl(location, current) : null;
    if (!next) throw new Error('Invalid redirect destination');
    if (new URL(next).origin !== initialOrigin && !allowedExternal(next)) throw new Error('Redirect escaped the allowed hosts');
    current = next;
  }
  if (!response) throw new Error('No HTTP response');
  const contentType = response.headers.get('content-type') ?? '';
  // Do not download large image/archive payloads merely to check their links.
  if (!/text|json|xml/i.test(contentType)) {
    await response.body?.cancel();
    return { status: response.status, finalUrl: current, contentType, body: '' };
  }
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let body = '', size = 0;
  if (reader) {
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 8_000_000) throw new Error('Response exceeds 8 MB audit limit');
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
    } finally { await reader.cancel(); }
  }
  return { status: response.status, finalUrl: current, contentType, body };
}

export async function auditSite(options: AuditOptions) {
  const origin = new URL(options.origin).origin;
  const maxPages = options.maxPages ?? 5000;
  const externalLimit = options.externalLimit ?? 250;
  const fetchPage = options.fetchPage ?? (url => fetchAuditPage(url, fetch, options.signal));
  const delay = options.delayMs ?? 150;
  const now = options.now ?? Date.now;
  const start = now();
  const budgetMs = options.budgetMs ?? Infinity;
  const resume = options.resume?.complete ? undefined : options.resume;
  if (options.resume && (options.resume.version !== 1 || options.resume.origin !== origin)) throw new Error('Invalid audit checkpoint origin or version');
  const queue: string[] = [...(resume?.queue ?? [])], internal = new Set(queue), external = new Set(resume?.external ?? []);
  const references = new Map<string, Set<string>>((resume?.references ?? []).map(([url, refs]) => [url, new Set(refs)]));
  const results: AuditResult[] = [...(resume?.results ?? [])];
  const ids = new Map<string, Set<string>>((resume?.ids ?? []).map(([url, values]) => [url, new Set(values)]));
  const fragments = new Map<string, { target: string; hash: string; reference: string }>(resume?.fragments ?? []);
  const blockedHosts = new Set<string>(); // retry blocked hosts on the next slice
  const externalChecked = new Set(resume?.externalChecked ?? []);
  // Advance once per completed crawl, independent of how many days it took.
  const sampleIndex = resume?.sampleIndex ?? (options.resume?.complete ? options.resume.sampleIndex + 1 : options.sampleIndex ?? 0);
  let index = resume?.index ?? 0;
  const initialIndex = index;
  const startedAt = resume?.startedAt ?? new Date().toISOString();
  let requestsThisRun = 0;
  const outOfTime = () => Boolean(options.signal?.aborted) || now() - start >= budgetMs;
  async function checkpoint(complete = false) {
    await options.onCheckpoint?.({ version: 1, origin, startedAt, sampleIndex,
      queue, index, external: [...external], externalChecked: [...externalChecked],
      references: [...references].map(([url, refs]) => [url, [...refs]]),
      ids: [...ids].map(([url, values]) => [url, [...values]]), fragments: [...fragments],
      results, blockedHosts: [...blockedHosts], complete });
  }
  function add(href: string, reference: string) {
    const url = normalizedUrl(href, reference);
    if (!url) return;
    if (!references.has(url)) references.set(url, new Set());
    if (references.get(url)!.size < 5) references.get(url)!.add(reference);
    const parsed = new URL(url);
    if (parsed.origin === origin) {
      const hash = new URL(href, reference).hash;
      if (hash && !hash.startsWith('#:~:text=')) {
        try { fragments.set(url + hash, { target: url, hash: decodeURIComponent(hash.slice(1)), reference }); } catch { /* malformed fragment is not a fetch target */ }
      }
      // Analytics is a write endpoint, never part of a read-only link audit.
      if (parsed.pathname === '/api/track') return;
      if (!internal.has(url)) { internal.add(url); queue.push(url); }
    } else external.add(url);
  }
  if (!resume) for (const seed of options.seeds ?? ['/', '/sitemap.xml', '/api/health', '/api/updates/health', '/api/packages']) add(seed, origin + '/');
  async function request(url: string): Promise<AuditResponse | null> {
    const refs = [...(references.get(url) ?? [])];
    try {
      // Checkpoint files are input too: do not let a modified cache bypass URL policy.
      if (!normalizedUrl(url, origin) || (new URL(url).origin !== origin && !allowedExternal(url))) throw new Error('URL outside audit policy');
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      const response = await fetchPage(url);
      let result = classifyLink(response);
      let reason: string | undefined;
      if (new URL(url).origin === origin && new URL(url).pathname.endsWith('/health') && response.status === 200) {
        try {
          const health = JSON.parse(response.body);
          if (!['ok', 'disabled'].includes(health.status)) { result = 'broken'; reason = 'Health reports ' + String(health.status); }
        } catch { result = 'broken'; reason = 'Invalid health JSON'; }
      }
      if (result === 'blocked') {
        blockedHosts.add(new URL(url).hostname);
        blockedHosts.add(new URL(response.finalUrl).hostname);
      }
      results.push({ url, result, status: response.status, finalUrl: response.finalUrl, reason, references: refs });
      options.onProgress?.(results.length);
      return result === 'reachable' ? response : null;
    } catch (error) {
      if (options.signal?.aborted) return null;
      results.push({ url, result: new URL(url).origin === origin ? 'broken' : 'unverified', reason: error instanceof Error ? error.message : String(error), references: refs });
      return null;
    }
  }
  await checkpoint();
  while (index < queue.length && index - initialIndex < maxPages && !outOfTime()
    && now() - start < budgetMs * 0.8) {
    const url = queue[index++];
    const response = await request(url);
    requestsThisRun++;
    if (!response) {
      if (options.signal?.aborted) { index--; break; }
      if (requestsThisRun % 100 === 0) await checkpoint();
      continue;
    }
    if (new URL(url).pathname === '/api/packages' || /\/api\/packages\/[^/]+\/versions$/.test(new URL(url).pathname)) {
      try {
        const data = JSON.parse(response.body);
        if (new URL(url).pathname === '/api/packages') {
          if (!Array.isArray(data.packages) || data.packages.some((pkg: { name?: unknown }) => typeof pkg?.name !== 'string' || !/^com\.unity\.[a-z0-9._-]+$/i.test(pkg.name))) throw new Error('Invalid packages payload');
          for (const pkg of data.packages) add('/api/packages/' + encodeURIComponent(pkg.name) + '/versions', url);
        } else {
          if (!Array.isArray(data.versions) || data.versions.some((v: { changelog?: unknown }) => !v || (v.changelog != null && typeof v.changelog !== 'string'))) throw new Error('Invalid package history payload');
          for (const version of data.versions) for (const href of changelogLinks(String(version.changelog ?? ''))) add(href, origin + '/packages');
          // Missing pagination is supported only for the older deployed API.
          if (data.page != null || data.pages != null) {
            if (!Number.isSafeInteger(data.page) || !Number.isSafeInteger(data.pages) || data.page < 1 || data.pages < data.page) throw new Error('Invalid package history pagination');
            if (data.page < data.pages) {
              const next = new URL(url); next.searchParams.set('page', String(data.page + 1)); add(next.href, url);
            }
          }
        }
      } catch (error) {
        const result = results[results.length - 1];
        result.result = 'broken';
        result.reason = error instanceof Error ? error.message : 'Invalid API payload';
      }
    } else if (response.contentType.includes('html')) {
      const $ = load(response.body);
      ids.set(url, new Set($('[id], a[name]').map((_, el) => $(el).attr('id') ?? $(el).attr('name') ?? '').get()));
      $('a[href]').each((_, el) => add($(el).attr('href')!, response.finalUrl));
    } else if (response.contentType.includes('xml')) {
      const $ = load(response.body, { xml: true });
      $('loc').each((_, el) => add($(el).text(), response.finalUrl));
    }
    if (requestsThisRun % 100 === 0) await checkpoint();
  }
  const ordered = [...external].sort();
  const sampleStart = ordered.length ? ((sampleIndex % ordered.length) * externalLimit) % ordered.length : 0;
  const selected = new Set(Array.from({ length: Math.min(externalLimit, ordered.length) }, (_, n) => ordered[(sampleStart + n) % ordered.length]));
  for (const url of ordered) {
    if (outOfTime()) break;
    if (externalChecked.has(url) || !allowedExternal(url) || !selected.has(url) || blockedHosts.has(new URL(url).hostname)) continue;
    await request(url);
    externalChecked.add(url);
    requestsThisRun++;
    if (requestsThisRun % 100 === 0) await checkpoint();
  }
  const pendingExternal = [...selected].some(url => allowedExternal(url) && !externalChecked.has(url) && !blockedHosts.has(new URL(url).hostname));
  const crawlComplete = index === queue.length && !pendingExternal;
  await checkpoint(crawlComplete);
  // Synthetic coverage entries belong in the report, never the resumable work state.
  const reportResults = [...results];
  for (const url of queue.slice(index)) reportResults.push({ url, result: 'unverified', reason: 'Internal crawl paused; queued for next run', references: [...(references.get(url) ?? [])] });
  for (const [url, fragment] of fragments) {
    const targets = ids.get(fragment.target);
    if (targets && !targets.has(fragment.hash)) reportResults.push({ url, result: 'broken', reason: 'Missing fragment target', references: [fragment.reference] });
  }
  for (const url of ordered.filter(url => !externalChecked.has(url))) reportResults.push({ url, result: 'unverified',
    reason: !allowedExternal(url) ? 'External host is outside the audit allowlist' : blockedHosts.has(new URL(url).hostname)
      ? 'Host blocked or rate-limited earlier in this run' : selected.has(url) ? 'External sample paused; queued for next run' : 'Outside this run’s rotating external sample', references: [...(references.get(url) ?? [])] });
  const broken = reportResults.filter(r => r.result === 'broken').length;
  const unverified = reportResults.filter(r => r.result === 'unverified' || r.result === 'blocked').length;
  const blockedInternal = results.some(r => new URL(r.url).origin === origin && r.result === 'blocked');
  return { checkedAt: new Date().toISOString(), startedAt, origin, broken, unverified, requestsThisRun,
    interrupted: Boolean(options.signal?.aborted), crawlComplete, blockedInternal,
    internalComplete: index === queue.length && !blockedInternal, complete: unverified === 0, results: reportResults };
}

export function auditExitCode(report: { broken: number; internalComplete: boolean; complete: boolean }, requireComplete = false) {
  return report.broken > 0 ? 1 : !report.internalComplete || (requireComplete && !report.complete) ? 2 : 0;
}
