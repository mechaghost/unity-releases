import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('deployment migration gate', () => {
  for (const fails of [true, false]) it(fails ? 'does not serve code after a failed migration' : 'starts the server after a successful migration', () => {
    const dir = mkdtempSync(join(tmpdir(), 'unity-boot-'));
    try {
      mkdirSync(join(dir, 'bin')); mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true });
      writeFileSync(join(dir, 'bin/npm'), `#!/bin/sh\necho migration-attempt\nexit ${fails ? 1 : 0}\n`, { mode: 0o755 });
      writeFileSync(join(dir, 'node_modules/.bin/next'), '#!/bin/sh\necho server-started\n', { mode: 0o755 });
      const result = spawnSync('sh', [resolve('scripts/boot.sh')], { cwd: dir, env: { ...process.env, PATH: join(dir, 'bin') + ':' + process.env.PATH }, encoding: 'utf8' });
      expect(result.stdout).toContain('migration-attempt');
      expect(result.status).toBe(fails ? 1 : 0);
      expect(result.stdout.includes('server-started')).toBe(!fails);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
