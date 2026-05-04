import { createHash } from "node:crypto";

export function sha256(value: unknown): string {
  const input = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(input).digest("hex");
}

export function createStableGuid(type: string, key: string): string {
  return `${type}:${sha256(`${type}:${key}`).slice(0, 24)}`;
}
