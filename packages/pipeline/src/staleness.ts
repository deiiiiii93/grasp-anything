import type { GraspState } from "./state";

export interface Fingerprints {
  docsHash: string;
  codeHash: string;
  signalsHash: string;
  broadness: "offline" | "web";
}

export interface StalenessOptions {
  refreshLandscape?: boolean;
  full?: boolean;
}

export interface Staleness {
  essence: boolean;
  success: boolean;
  landscape: boolean;
  firstRun: boolean;
}

/**
 * Per-stream staleness. Streams are independent (spec §7):
 *  - essence   ← docs or code changed
 *  - success   ← signals changed
 *  - landscape ← market-stable: only a broadness change or an explicit refresh
 * A first run or --full forces everything stale.
 */
export function diffStaleness(
  prior: GraspState | null,
  next: Fingerprints,
  opts: StalenessOptions = {},
): Staleness {
  const firstRun = prior === null;
  if (firstRun || opts.full) {
    return { essence: true, success: true, landscape: true, firstRun };
  }
  return {
    essence: prior.docsHash !== next.docsHash || prior.codeHash !== next.codeHash,
    success: prior.signalsHash !== next.signalsHash,
    landscape: Boolean(opts.refreshLandscape) || prior.broadness !== next.broadness,
    firstRun,
  };
}
