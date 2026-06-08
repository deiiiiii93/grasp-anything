import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assemble } from "./assemble";
import { render } from "./render";

interface Args {
  fragmentsDir?: string;
  target?: string;
  dist?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target") args.target = argv[++i];
    else if (a === "--dist") args.dist = argv[++i];
    else positional.push(a);
  }
  if (positional.length > 0) args.fragmentsDir = positional[0];
  return args;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Returns a process exit code: 0 ok, 1 assembly/validation failed, 2 usage/IO error. */
export function runCli(argv: string[]): number {
  const { fragmentsDir, target, dist } = parseArgs(argv);
  if (!fragmentsDir || !target || !dist) {
    console.error(
      "usage: grasp-assemble <fragmentsDir> --target <repoDir> --dist <dashboardDist>",
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

  const result = assemble({ meta, essence, success, landscape });
  if (!result.ok) {
    console.error("✗ Could not assemble a valid repo-brief:");
    for (const e of result.errors) console.error(`  - ${e}`);
    return 1;
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
