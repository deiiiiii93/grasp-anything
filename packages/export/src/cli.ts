#!/usr/bin/env tsx
import { runExport } from "./cli-run";

process.exit(runExport(process.argv.slice(2)));
