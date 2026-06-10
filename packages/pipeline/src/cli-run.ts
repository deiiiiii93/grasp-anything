import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assemble } from "./assemble";
import { render } from "./render";

interface Args {
  fragmentsDir?: string;
  target?: string;
  dist?: string;
  prior?: string;
  stale?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target") args.target = argv[++i];
    else if (a === "--dist") args.dist = argv[++i];
    else if (a === "--prior") args.prior = argv[++i];
    else if (a === "--stale") args.stale = argv[++i];
    else positional.push(a);
  }
  if (positional.length > 0) args.fragmentsDir = positional[0];
  return args;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

type Stream = "essence" | "success" | "landscape";
const STREAMS: Stream[] = ["essence", "success", "landscape"];

/** From a prior brief + the stale set, build the per-stream updatedAt override (fresh streams keep prior timestamps). */
function resolveUpdatedAt(
  priorPath: string | undefined,
  staleList: string | undefined,
): { essence?: string; success?: string; landscape?: string } | undefined {
  if (!priorPath) return undefined;
  let prior: { brief?: { updatedAt?: Record<string, unknown> } };
  try {
    prior = JSON.parse(readFileSync(priorPath, "utf8"));
  } catch {
    return undefined; // unreadable prior → full run (no preservation)
  }
  const stale = new Set((staleList ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const priorUpdated = prior.brief?.updatedAt ?? {};
  const override: { essence?: string; success?: string; landscape?: string } = {};
  for (const s of STREAMS) {
    const value = priorUpdated[s];
    if (!stale.has(s) && typeof value === "string") override[s] = value;
  }
  return override;
}

/** Returns a process exit code: 0 ok, 1 assembly/validation failed, 2 usage/IO error. */
export function runCli(argv: string[]): number {
  const { fragmentsDir, target, dist, prior, stale } = parseArgs(argv);
  if (!fragmentsDir || !target || !dist) {
    console.error(
      "usage: grasp-assemble <fragmentsDir> --target <repoDir> --dist <dashboardDist> [--prior <priorBrief>] [--stale <streams>]",
    );
    return 2;
  }

  let meta: unknown;
  let essence: unknown;
  let success: unknown;
  let landscape: unknown;
  try {
    meta = readJson(join(fragmentsDir, "meta.json"));
    essence = readJson(join(fragmentsDir, "essence.json"));
    success = readJson(join(fragmentsDir, "success.json"));
    const landscapePath = join(fragmentsDir, "landscape.json");
    landscape = existsSync(landscapePath) ? readJson(landscapePath) : undefined;
  } catch (err) {
    console.error(`Cannot read fragments in ${fragmentsDir}: ${(err as Error).message}`);
    return 2;
  }

  const result = assemble({
    meta,
    essence,
    success,
    landscape,
    updatedAt: resolveUpdatedAt(prior, stale),
  });
  if (!result.ok) {
    console.error("✗ Could not assemble a valid repo-brief:");
    for (const e of result.errors) console.error(`  - ${e}`);
    return 1;
  }

  if (result.warnings.length > 0) {
    console.error("⚠ Atlas density warnings (brief is valid but thin):");
    for (const w of result.warnings) console.error(`  - ${w}`);
  }

  try {
    const { briefPath, indexPath } = render({ doc: result.doc, targetDir: target, distDir: dist });
    console.error(`✓ Wrote ${briefPath}`);
    console.log(indexPath);
    return 0;
  } catch (err) {
    console.error(`Render failed: ${(err as Error).message}`);
    return 2;
  }
}
