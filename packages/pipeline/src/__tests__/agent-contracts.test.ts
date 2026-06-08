import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import {
  EssenceFragmentSchema,
  SuccessFragmentSchema,
  LandscapeFragmentSchema,
} from "../fragments";

const here = dirname(fileURLToPath(import.meta.url));
const agentsDir = resolve(here, "../../../../agents");

function extractExample(file: string): unknown {
  const md = readFileSync(resolve(agentsDir, file), "utf8");
  const m = md.match(/<!--\s*example\s*-->\s*```json\s*([\s\S]*?)```/);
  if (!m) throw new Error(`no <!-- example --> json block in ${file}`);
  return JSON.parse(m[1]);
}

const cases: [string, z.ZodTypeAny][] = [
  ["essence-analyzer.md", EssenceFragmentSchema],
  ["success-analyzer.md", SuccessFragmentSchema],
  ["landscape-analyzer.md", LandscapeFragmentSchema],
];

describe("agent output contracts", () => {
  for (const [file, schema] of cases) {
    it(`${file} embeds an example that matches its fragment schema`, () => {
      const example = extractExample(file);
      const result = schema.safeParse(example);
      expect(result.success).toBe(true);
    });
  }
});
