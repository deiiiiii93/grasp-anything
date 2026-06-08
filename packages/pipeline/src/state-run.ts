import { readFileSync } from "node:fs";
import { z } from "zod";
import { hashFiles, hashSignals } from "./fingerprint";
import { diffStaleness, type Fingerprints } from "./staleness";
import { readState, writeState } from "./state";

interface Args {
  target?: string;
  sources?: string;
  refreshLandscape?: boolean;
  full?: boolean;
  dryRun?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target") args.target = argv[++i];
    else if (a === "--sources") args.sources = argv[++i];
    else if (a === "--refresh-landscape") args.refreshLandscape = true;
    else if (a === "--full") args.full = true;
    else if (a === "--dry-run") args.dryRun = true;
  }
  return args;
}

const SourcesSchema = z.object({
  docs: z.array(z.string()).default([]),
  code: z.array(z.string()).default([]),
  signals: z.record(z.unknown()).default({}),
  broadness: z.enum(["offline", "web"]),
});

/** Exit code: 0 ok, 2 usage/IO error. Prints the staleness verdict (JSON) to stdout. */
export function runState(argv: string[]): number {
  const { target, sources, refreshLandscape, full, dryRun } = parseArgs(argv);
  if (!target || !sources) {
    console.error("usage: grasp-state --target <dir> --sources <sources.json> [--refresh-landscape] [--full] [--dry-run]");
    return 2;
  }

  let parsed: z.infer<typeof SourcesSchema>;
  try {
    const raw = JSON.parse(readFileSync(sources, "utf8"));
    const result = SourcesSchema.safeParse(raw);
    if (!result.success) {
      const detail = result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
      console.error(`Invalid sources ${sources}: ${detail}`);
      return 2;
    }
    parsed = result.data;
  } catch (err) {
    console.error(`Cannot read sources ${sources}: ${(err as Error).message}`);
    return 2;
  }

  const next: Fingerprints = {
    docsHash: hashFiles(target, parsed.docs),
    codeHash: hashFiles(target, parsed.code),
    signalsHash: hashSignals(parsed.signals),
    broadness: parsed.broadness,
  };

  const prior = readState(target);
  const staleness = diffStaleness(prior, next, { refreshLandscape, full });

  if (!dryRun) {
    try {
      writeState(target, { version: 1, ...next });
    } catch (err) {
      console.error(`Cannot write state for ${target}: ${(err as Error).message}`);
      return 2;
    }
  }

  console.log(JSON.stringify(staleness));
  return 0;
}
