#!/usr/bin/env tsx
import { runCli } from "./cli-run";

process.exit(runCli(process.argv.slice(2)));
