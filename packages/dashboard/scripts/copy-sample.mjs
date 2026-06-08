import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../schema/sample-brief.json");
const destDir = resolve(here, "../public");
mkdirSync(destDir, { recursive: true });
copyFileSync(src, resolve(destDir, "repo-brief.json"));
console.log("Copied sample-brief.json -> public/repo-brief.json");
