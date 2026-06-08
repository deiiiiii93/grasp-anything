import { z } from "zod";
import { MetaSchema, EvidenceSchema, validateBrief, type BriefDoc } from "@grasp/schema";
import {
  EssenceFragmentSchema,
  SuccessFragmentSchema,
  LandscapeFragmentSchema,
} from "./fragments";

type Meta = z.infer<typeof MetaSchema>;
type Evidence = z.infer<typeof EvidenceSchema>;

export interface AssembleInput {
  meta: unknown;
  essence: unknown;
  success: unknown;
  /** Omit (or pass undefined/null) for offline runs — a self-only landscape is synthesized. */
  landscape?: unknown;
}

export type AssembleResult =
  | { ok: true; doc: BriefDoc }
  | { ok: false; errors: string[] };

function collect(
  prefix: string,
  result: z.SafeParseReturnType<unknown, unknown>,
  errors: string[],
): void {
  if (result.success) return;
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "(root)";
    errors.push(`${prefix}.${path}: ${issue.message}`);
  }
}

function mergeBriefEvidence(
  ...maps: Record<string, string[] | undefined>[]
): Record<string, string[]> | undefined {
  const merged: Record<string, string[]> = {};
  for (const map of maps) {
    for (const [key, ids] of Object.entries(map)) {
      if (ids && ids.length > 0) merged[key] = ids;
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function synthesizeSelfLandscape(meta: Meta) {
  return {
    nodes: [
      { id: "self", type: "self" as const, name: meta.repo, url: meta.url, evidenceIds: [] },
    ],
    edges: [],
  };
}

export function assemble(input: AssembleInput): AssembleResult {
  const errors: string[] = [];

  const metaParsed = MetaSchema.safeParse(input.meta);
  collect("meta", metaParsed, errors);
  const essParsed = EssenceFragmentSchema.safeParse(input.essence);
  collect("essence", essParsed, errors);
  const sucParsed = SuccessFragmentSchema.safeParse(input.success);
  collect("success", sucParsed, errors);

  const hasLandscape = input.landscape !== undefined && input.landscape !== null;
  const landParsed = hasLandscape ? LandscapeFragmentSchema.safeParse(input.landscape) : null;
  if (landParsed) collect("landscape", landParsed, errors);

  if (errors.length > 0) return { ok: false, errors };

  const meta = metaParsed.data!;
  const essence = essParsed.data!;
  const success = sucParsed.data!;
  const landscape = landParsed && landParsed.success ? landParsed.data : null;

  // Merge evidence by id; an id reused with different content is an authoring bug.
  const evidenceById = new Map<string, Evidence>();
  const conflicts: string[] = [];
  const addEvidence = (list: Evidence[]) => {
    for (const e of list) {
      const existing = evidenceById.get(e.id);
      if (existing) {
        if (JSON.stringify(existing) !== JSON.stringify(e)) {
          conflicts.push(`evidence: duplicate id '${e.id}' with conflicting content`);
        }
        continue;
      }
      evidenceById.set(e.id, e);
    }
  };
  addEvidence(essence.evidence);
  addEvidence(success.evidence);
  if (landscape) addEvidence(landscape.evidence);
  if (conflicts.length > 0) return { ok: false, errors: conflicts };

  const briefEvidence = mergeBriefEvidence(essence.briefEvidence, success.briefEvidence);

  const doc = {
    meta,
    brief: {
      idea: essence.idea,
      problem: essence.problem,
      why: success.why,
      how: essence.how,
      takeaway: success.takeaway,
      updatedAt: {
        essence: meta.analyzedAt,
        success: meta.analyzedAt,
        landscape: meta.analyzedAt,
      },
      ...(briefEvidence ? { evidence: briefEvidence } : {}),
    },
    conceptGraph: essence.conceptGraph,
    landscapeGraph: landscape ? landscape.landscapeGraph : synthesizeSelfLandscape(meta),
    evidence: [...evidenceById.values()],
  };

  const validated = validateBrief(doc);
  if (!validated.ok || !validated.data) {
    return { ok: false, errors: validated.errors.map((e) => `assembled brief: ${e}`) };
  }
  return { ok: true, doc: validated.data };
}
