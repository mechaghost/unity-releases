import { spawn } from "node:child_process";

export type ProcessResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  cancelled: boolean;
  stdout: string;
  stderr: string;
};

/** Bound each child, and kill its whole Unix process group before moving on. */
export function runSupervisedProcess(command: string, args: string[], options: {
  timeoutMs: number;
  graceMs?: number;
  signal?: AbortSignal;
  streamOutput?: boolean;
}): Promise<ProcessResult> {
  const result: ProcessResult = { exitCode: null, signal: null, timedOut: false, cancelled: false, stdout: "", stderr: "" };
  if (options.signal?.aborted) return Promise.resolve({ ...result, cancelled: true });
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) throw new Error("A positive process timeout is required");
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: process.env, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    let stopping = false;
    let finished = false;
    let closed = false;
    let escalated = false;
    let killTimer: NodeJS.Timeout | undefined;
    const terminate = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        if (process.platform === "win32") {
          // taskkill includes npm's descendants on Windows as well.
          const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
          killer.on("error", () => child.kill(signal));
        } else process.kill(-child.pid, signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") console.error("Could not stop cron child", error);
      }
    };
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      clearTimeout(killTimer);
      options.signal?.removeEventListener("abort", cancel);
      child.stdout?.destroy();
      child.stderr?.destroy();
      child.unref();
      if (error) reject(error); else resolve(result);
    };
    const stop = () => {
      if (stopping || finished) return;
      stopping = true;
      terminate("SIGTERM");
      // Do not cancel this timer when the leader exits: descendants may still
      // be running, even if they closed their inherited stdout/stderr.
      killTimer = setTimeout(() => {
        escalated = true;
        terminate("SIGKILL");
        if (closed) finish();
        else killTimer = setTimeout(() => finish(), 1000);
      }, options.graceMs ?? 5000);
    };
    const cancel = () => { result.cancelled = true; stop(); };
    const timeout = setTimeout(() => { result.timedOut = true; stop(); }, options.timeoutMs);
    options.signal?.addEventListener("abort", cancel, { once: true });
    for (const name of ["stdout", "stderr"] as const) {
      child[name]?.on("data", (chunk: Buffer) => {
        result[name] = (result[name] + chunk.toString()).slice(-64 * 1024);
        if (options.streamOutput) process[name].write(chunk);
      });
    }
    child.once("error", finish);
    child.once("close", (exitCode, signal) => {
      closed = true;
      result.exitCode = exitCode;
      result.signal = signal;
      if (!stopping || escalated) finish();
    });
  });
}

/** Install only at CLI boundaries, never when imported by tests or the web app. */
export function cronShutdown() {
  const controller = new AbortController();
  const terminate = () => { process.exitCode = 143; controller.abort(); };
  const interrupt = () => { process.exitCode = 130; controller.abort(); };
  process.once("SIGTERM", terminate);
  process.once("SIGINT", interrupt);
  return { signal: controller.signal, dispose() {
    process.removeListener("SIGTERM", terminate);
    process.removeListener("SIGINT", interrupt);
  } };
}
