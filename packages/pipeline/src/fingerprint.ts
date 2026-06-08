import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Order-independent content hash of a set of files (paths relative to targetDir).
 * A missing file hashes to a fixed sentinel so the result stays deterministic.
 */
export function hashFiles(targetDir: string, relPaths: string[]): string {
  const lines = [...relPaths]
    .sort()
    .map((rel) => {
      const abs = join(targetDir, rel);
      const content = existsSync(abs) ? readFileSync(abs, "utf8") : " missing";
      return `${rel}\n${sha256(content)}`;
    });
  return sha256(lines.join("\n"));
}

/** Stable hash of signals, independent of key order. */
export function hashSignals(signals: Record<string, unknown> | undefined): string {
  const obj = signals ?? {};
  const sortedKeys = Object.keys(obj).sort();
  return sha256(JSON.stringify(obj, sortedKeys));
}
