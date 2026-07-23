import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const SKILLS = [
  ".agents/skills/ship-release/SKILL.md",
  ".agents/skills/unity-package-versioning/SKILL.md"
];

describe("repository Codex skills", () => {
  test("keeps the project-specific skill entrypoints tracked and discoverable", () => {
    for (const skill of SKILLS) {
      expect(existsSync(skill), `${skill} should exist`).toBe(true);
    }
    const gitignore = readFileSync(".gitignore", "utf8");
    expect(gitignore).not.toMatch(/^\.agents\/$/m);
  });
});
