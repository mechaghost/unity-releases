import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { auditSite, auditExitCode } from '../src/lib/link-audit';

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf('--' + name);
  if (index < 0) return fallback;
  if (!process.argv[index + 1] || process.argv[index + 1].startsWith('--')) throw new Error(`Missing value for --${name}`);
  return process.argv[index + 1];
}
function integer(name: string, fallback: number, maximum: number) {
  const value = Number(arg(name, String(fallback)));
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error(`Invalid --${name} (0–${maximum})`);
  return value;
}
async function main() {
  const origin = new URL(arg('site', 'https://unityreleases.com')).origin;
  const output = arg('output', '.artifacts/link-check.json');
  const report = await auditSite({
    origin, maxPages: integer('max-pages', 12000, 20000),
    externalLimit: integer('external-limit', 250, 5000),
    sampleIndex: integer('sample-index', Math.floor(Date.now() / 86_400_000), Number.MAX_SAFE_INTEGER),
    delayMs: integer('delay-ms', 150, 10000),
    onProgress: count => { if (count % 100 === 0) console.log(`${count} URLs requested`); }
  });
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  const summary = `${report.results.length} destinations recorded; ${report.broken} failures; ${report.unverified} unverified. Evidence: ${output}`;
  console.log(summary);
  for (const result of report.results.filter(r => r.result === 'broken').slice(0,20)) console.error(`${result.status ?? ''} ${result.url} ${result.reason ?? ''}`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Site link check\n\n${summary}\n\nUnverified includes blocked hosts, network failures, and URLs outside this run's limits. See the uploaded JSON for exact URLs and referring pages.\n`);
  process.exitCode = auditExitCode(report, process.argv.includes('--require-complete'));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
