#!/usr/bin/env tsx
import { installAutoUpdate, removeAutoUpdate } from "./autoupdate";

function main(argv: string[]): number {
  const off = argv.includes("--off");
  const target = (() => {
    const i = argv.indexOf("--target");
    return i >= 0 ? argv[i + 1] : process.cwd();
  })();
  try {
    if (off) removeAutoUpdate(target);
    else installAutoUpdate(target);
    console.log(off ? "grasp: auto-update disabled" : "grasp: auto-update enabled (post-commit hook installed)");
    return 0;
  } catch (err) {
    console.error((err as Error).message);
    return 2;
  }
}

process.exit(main(process.argv.slice(2)));
