import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BriefDoc } from "@grasp/schema";

export interface RenderInput {
  doc: BriefDoc;
  /** Repo root being analyzed; output goes to <targetDir>/.grasp/dashboard. */
  targetDir: string;
  /** The vendored dashboard build (packages/dashboard/dist). */
  distDir: string;
}

export interface RenderResult {
  outputDir: string;
  briefPath: string;
  indexPath: string;
}

/**
 * Writes the self-contained report: copies the pre-built dashboard beside the
 * brief so the page can fetch ./repo-brief.json over file://. Never builds anything.
 */
export function render({ doc, targetDir, distDir }: RenderInput): RenderResult {
  if (!existsSync(distDir)) {
    throw new Error(
      `dashboard dist not found at ${distDir} — build it first: npm run build --workspace @grasp/dashboard`,
    );
  }
  const outputDir = join(targetDir, ".grasp", "dashboard");
  mkdirSync(outputDir, { recursive: true });
  cpSync(distDir, outputDir, { recursive: true });

  const briefPath = join(outputDir, "repo-brief.json");
  writeFileSync(briefPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

  return { outputDir, briefPath, indexPath: join(outputDir, "index.html") };
}
