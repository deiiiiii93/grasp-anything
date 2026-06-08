import { z } from "zod";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const GraspStateSchema = z.object({
  version: z.literal(1),
  docsHash: z.string(),
  codeHash: z.string(),
  signalsHash: z.string(),
  broadness: z.enum(["offline", "web"]),
});

export type GraspState = z.infer<typeof GraspStateSchema>;

export function statePath(targetDir: string): string {
  return join(targetDir, ".grasp", "state.json");
}

/** Reads prior state. Returns null on missing / unparseable / schema-mismatched files — all treated as "no prior", i.e. a full run (spec §8). */
export function readState(targetDir: string): GraspState | null {
  const path = statePath(targetDir);
  if (!existsSync(path)) return null;
  try {
    const parsed = GraspStateSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeState(targetDir: string, state: GraspState): void {
  const path = statePath(targetDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
