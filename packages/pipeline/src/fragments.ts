import { z } from "zod";
import {
  AtlasSchema,
  LandscapeNodeSchema,
  LandscapeEdgeSchema,
  EvidenceSchema,
} from "@grasp/schema";

/**
 * Each analyzer agent emits one fragment. Fragment schemas validate SHAPE only —
 * referential integrity (evidence resolution, exactly-one-idea, exactly-one-self)
 * is enforced once on the assembled BriefDoc by validateBrief, because a fragment
 * validated alone cannot resolve evidence ids introduced by a sibling fragment.
 */

export const EssenceFragmentSchema = z.object({
  idea: z.string().min(1),
  problem: z.string().min(1),
  how: z.string().min(1),
  atlas: AtlasSchema,
  evidence: z.array(EvidenceSchema).default([]),
  briefEvidence: z
    .object({
      idea: z.array(z.string()).optional(),
      problem: z.array(z.string()).optional(),
      how: z.array(z.string()).optional(),
    })
    .default({}),
});

export const SuccessFragmentSchema = z.object({
  why: z.string().min(1),
  takeaway: z.string().min(1),
  evidence: z.array(EvidenceSchema).default([]),
  briefEvidence: z
    .object({
      why: z.array(z.string()).optional(),
      takeaway: z.array(z.string()).optional(),
    })
    .default({}),
});

export const LandscapeFragmentSchema = z.object({
  landscapeGraph: z.object({
    nodes: z.array(LandscapeNodeSchema),
    edges: z.array(LandscapeEdgeSchema),
  }),
  evidence: z.array(EvidenceSchema).default([]),
});

export type EssenceFragment = z.infer<typeof EssenceFragmentSchema>;
export type SuccessFragment = z.infer<typeof SuccessFragmentSchema>;
export type LandscapeFragment = z.infer<typeof LandscapeFragmentSchema>;
