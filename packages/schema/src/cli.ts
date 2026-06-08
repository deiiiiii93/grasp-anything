#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { validateBrief } from "./validate";

function main(): number {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: grasp-validate <repo-brief.json>");
    return 2;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`Cannot read or parse ${path}: ${(err as Error).message}`);
    return 2;
  }

  const { ok, errors } = validateBrief(parsed);
  if (ok) {
    console.log(`✓ ${path} is a valid repo-brief`);
    return 0;
  }

  console.error(`✗ ${path} is invalid:`);
  for (const e of errors) console.error(`  - ${e}`);
  return 1;
}

process.exit(main());
