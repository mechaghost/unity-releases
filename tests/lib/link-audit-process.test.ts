import { expect, test } from 'vitest';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test.skipIf(process.platform === 'win32')('SIGTERM during HTTP preserves the queue and partial report', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'unity-audit-'));
  let requested!: () => void;
  const waiting = new Promise<void>(resolve => { requested = resolve; });
  const server = createServer((req, res) => {
    if (req.url === '/slow') { requested(); return; }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<a href="/slow">Slow</a>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const cursor = join(dir, 'cursor.json'), output = join(dir, 'report.json');
  const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/check-site-links.ts', '--site', `http://127.0.0.1:${address.port}`,
    '--delay-ms', '0', '--resume', cursor, '--output', output], { stdio: 'ignore' });
  const exited = new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  try {
    await waiting;
    child.kill('SIGTERM');
    expect(await exited).toBe(2);
    const checkpoint = JSON.parse(await readFile(cursor, 'utf8'));
    expect(checkpoint.complete).toBe(false);
    expect(checkpoint.queue[checkpoint.index]).toMatch(/\/slow$/);
    expect(checkpoint.results.length).toBeGreaterThan(0);
    expect(JSON.parse(await readFile(output, 'utf8')).interrupted).toBe(true);
  } finally {
    child.kill('SIGKILL');
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
}, 10_000);
