import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function checkHealth(origin, fetchImpl = fetch, now = Date.now()) {
  const checks = await Promise.all(['/api/health', '/api/updates/health'].map(async path => {
    try {
      const response = await fetchImpl(new URL(path, origin), { signal: AbortSignal.timeout(15_000), cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.status !== 'ok') throw new Error(`Health reports ${String(data.status)}`);
      if (path === '/api/health' && (!data.databaseConfigured || !Array.isArray(data.ingestion) || !data.ingestion.length)) throw new Error('Missing core health coverage');
      if (path === '/api/updates/health' && (!data.configured || !data.ingestionEnabled || !Array.isArray(data.sources) || !data.sources.length)) throw new Error('Missing product health coverage');
      const checked = Date.parse(data.checkedAt);
      if (!Number.isFinite(checked) || now - checked > 10 * 60_000 || checked > now + 60_000) throw new Error('Missing or stale health timestamp');
      return { path, ok: true };
    } catch (error) { return { path, ok: false, error: error instanceof Error ? error.message : String(error) }; }
  }));
  return { status: checks.every(c => c.ok) ? 'ok' : 'failed', checkedAt: new Date(now).toISOString(), checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await checkHealth(process.env.SITE_ORIGIN ?? 'https://unityreleases.com');
  await mkdir('.artifacts', { recursive: true });
  await writeFile('.artifacts/health.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  process.exitCode = report.status === 'ok' ? 0 : 1;
}
