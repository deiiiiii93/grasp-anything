import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { validateBrief } from "@grasp/schema";
import { briefToMarkdown } from "./markdown";
import { briefToPrintHtml } from "./printHtml";

interface Args {
  briefPath?: string;
  format?: string;
  out?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--format") args.format = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else positional.push(a);
  }
  if (positional.length > 0) args.briefPath = positional[0];
  return args;
}

/** Exit code: 0 ok, 1 invalid brief, 2 usage/IO error. */
export function runExport(argv: string[]): number {
  const { briefPath, format = "both", out } = parseArgs(argv);
  if (!briefPath) {
    console.error("usage: grasp-export <brief.json> [--format md|html|both] [--out <dir>]");
    return 2;
  }
  if (!["md", "html", "both"].includes(format)) {
    console.error(`unknown --format '${format}' (use md|html|both)`);
    return 2;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(briefPath, "utf8"));
  } catch (err) {
    console.error(`Cannot read ${briefPath}: ${(err as Error).message}`);
    return 2;
  }

  const { ok, errors, data } = validateBrief(raw);
  if (!ok || !data) {
    console.error(`✗ ${briefPath} is not a valid repo-brief:`);
    for (const e of errors) console.error(`  - ${e}`);
    return 1;
  }

  const outDir = out ?? dirname(resolve(briefPath));
  try {
    mkdirSync(outDir, { recursive: true });
    const written: string[] = [];
    if (format === "md" || format === "both") {
      const p = join(outDir, "report.md");
      writeFileSync(p, briefToMarkdown(data), "utf8");
      written.push(p);
    }
    if (format === "html" || format === "both") {
      const p = join(outDir, "report.html");
      writeFileSync(p, briefToPrintHtml(data), "utf8");
      written.push(p);
    }
    for (const p of written) console.log(p);
    return 0;
  } catch (err) {
    console.error(`Cannot write to ${outDir}: ${(err as Error).message}`);
    return 2;
  }
}
