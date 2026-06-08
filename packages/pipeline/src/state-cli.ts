#!/usr/bin/env tsx
import { runState } from "./state-run";

process.exit(runState(process.argv.slice(2)));
