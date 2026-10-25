import { expect, test } from "vitest";
import { runSupervisedProcess } from "../../src/lib/ingest/supervised-process";

test("successful commands preserve output and exit status", async () => {
  const result = await runSupervisedProcess(process.execPath, ["-e", "console.log('done')"], { timeoutMs: 2000 });
  expect(result).toMatchObject({ exitCode: 0, timedOut: false, cancelled: false });
  expect(result.stdout).toContain("done");
});
test("hung commands that ignore termination are killed", async () => {
  const result = await runSupervisedProcess(process.execPath, ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], { timeoutMs: 250, graceMs: 50 });
  expect(result.timedOut).toBe(true);
  expect(result.exitCode).not.toBe(0);
});
test("shutdown cancels active work and does not spawn already cancelled work", async () => {
  const controller = new AbortController();
  const pending = runSupervisedProcess(process.execPath, ["-e", "setInterval(()=>{},1000)"], { timeoutMs: 2000, graceMs: 20, signal: controller.signal });
  controller.abort();
  expect((await pending).cancelled).toBe(true);
  expect((await runSupervisedProcess("missing-command", [], { timeoutMs: 2000, signal: controller.signal })).cancelled).toBe(true);
});
test.skipIf(process.platform === "win32")("cleans up descendants even when their leader exits on SIGTERM", async () => {
  const code = `const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],{stdio:'ignore'});console.log(c.pid);setInterval(()=>{},1000);`;
  const result = await runSupervisedProcess(process.execPath, ["-e", code], { timeoutMs: 400, graceMs: 100 });
  const pid = Number(result.stdout.trim());
  expect(pid).toBeGreaterThan(0);
  // Allow the OS to reap the descendant after the group kill.
  await expect.poll(() => { try { process.kill(pid, 0); return false; } catch { return true; } }).toBe(true);
});

test("missing commands reject promptly", async () => {
  await expect(runSupervisedProcess("/missing/cron-executable", [], { timeoutMs: 2000 })).rejects.toThrow();
});

test("captured logs stay bounded", async () => {
  const result = await runSupervisedProcess(process.execPath, ["-e", "process.stdout.write('x'.repeat(200000))"], { timeoutMs: 2000 });
  expect(result.stdout.length).toBe(64 * 1024);
  expect(result.exitCode).toBe(0);
});
