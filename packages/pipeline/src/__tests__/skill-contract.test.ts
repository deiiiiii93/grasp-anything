import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const skillPath = resolve(here, "../../../../skills/grasp/SKILL.md");

describe("SKILL.md orchestrator contract", () => {
  const md = readFileSync(skillPath, "utf8");

  it("declares the skill name in frontmatter", () => {
    expect(md).toMatch(/^---[\s\S]*?\nname:\s*grasp\b/);
  });

  it("references the real moving parts (drift guard)", () => {
    for (const token of [
      "grasp-assemble",
      "essence-analyzer",
      "success-analyzer",
      "landscape-analyzer",
      "depth",
      "broadness",
      ".grasp",
    ]) {
      expect(md).toContain(token);
    }
  });
});
