import { mkdir, writeFile, appendFile, readFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { auditSite, auditExitCode, type AuditCheckpoint } from '../src/lib/link-audit';

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
  const resumePath = process.argv.includes('--resume') ? arg('resume', '.artifacts/link-cursor.json') : null;
  let resume: AuditCheckpoint | undefined;
  if (resumePath) {
    try { resume = JSON.parse(await readFile(resumePath, 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  async function save(path: string, data: unknown) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path + '.tmp', JSON.stringify(data) + '\n');
    await rename(path + '.tmp', path);
  }
  const report = await auditSite({
    origin, maxPages: integer('max-pages', 12000, 20000),
    externalLimit: integer('external-limit', 250, 5000),
    sampleIndex: integer('sample-index', Math.floor(Date.now() / 86_400_000), Number.MAX_SAFE_INTEGER),
    delayMs: integer('delay-ms', 150, 10000),
    budgetMs: integer('budget-seconds', 1200, 7200) * 1000,
    signal: controller.signal, resume,
    onCheckpoint: async state => {
      if (resumePath) await save(resumePath, state);
      await save(output, { checkedAt: new Date().toISOString(), partial: true,
        checked: state.index, queued: state.queue.length - state.index,
        broken: state.results.filter(r => r.result === 'broken').length, results: state.results });
    },
    onProgress: count => { if (count % 100 === 0) console.log(`${count} URLs requested`); }
  });
  process.off('SIGTERM', stop); process.off('SIGINT', stop);
  await save(output, report);
  const summary = `${report.results.length} destinations recorded; ${report.broken} failures; ${report.unverified} unverified. Evidence: ${output}`;
  console.log(summary);
  for (const result of report.results.filter(r => r.result === 'broken').slice(0,20)) console.error(`${result.status ?? ''} ${result.url} ${result.reason ?? ''}`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Site link check\n\n${summary}\n\nUnverified includes blocked hosts, network failures, and URLs outside this run's limits. See the uploaded JSON for exact URLs and referring pages.\n`);
  // A saved queue is an intentional slice, not evidence that unchecked pages passed.
  process.exitCode = report.interrupted ? 2 : resumePath && !process.argv.includes('--require-complete')
    ? report.broken > 0 || report.blockedInternal ? 1 : 0
    : auditExitCode(report, process.argv.includes('--require-complete'));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
