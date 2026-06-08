import { z } from "zod";

export const conceptNodeTypes = ["problem", "idea", "mechanism", "outcome", "feature"] as const;
export const conceptEdgeTypes = ["addresses", "composedOf", "enables", "produces"] as const;
export const landscapeNodeTypes = ["self", "alternative", "category"] as const;
export const landscapeEdgeTypes = ["competesWith", "sharesApproach", "alternativeTo"] as const;

const ConceptNode = z.object({
  id: z.string().min(1),
  type: z.enum(conceptNodeTypes),
  label: z.string().min(1),
  detail: z.string().default(""),
  evidenceIds: z.array(z.string()).default([]),
});

const ConceptEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.enum(conceptEdgeTypes),
});

const LandscapeNode = z.object({
  id: z.string().min(1),
  type: z.enum(landscapeNodeTypes),
  name: z.string().optional(),
  label: z.string().optional(),
  url: z.string().url().optional(),
  stars: z.number().int().nonnegative().optional(),
  oneLiner: z.string().optional(),
  similarity: z.number().min(0).max(1).optional(),
  differentiator: z.string().optional(),
  category: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
});

const LandscapeEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.enum(landscapeEdgeTypes),
});

const Evidence = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  source: z.string().min(1),
  url: z.string().url().optional(),
  verified: z.boolean(),
});

const Meta = z.object({
  repo: z.string().min(1),
  url: z.string().url().optional(),
  analyzedAt: z.string().min(1),
  depth: z.enum(["docs", "skim", "deep"]),
  broadness: z.enum(["offline", "web"]),
  signals: z
    .object({
      stars: z.number().int().nonnegative().optional(),
      lastCommit: z.string().optional(),
      language: z.string().optional(),
    })
    .default({}),
});

const Brief = z.object({
  idea: z.string().min(1),
  problem: z.string().min(1),
  why: z.string().min(1),
  how: z.string().min(1),
  takeaway: z.string().min(1),
  updatedAt: z.object({
    essence: z.string().min(1),
    success: z.string().min(1),
    landscape: z.string().min(1),
  }),
});

export const BriefDocSchema = z.object({
  meta: Meta,
  brief: Brief,
  conceptGraph: z.object({ nodes: z.array(ConceptNode), edges: z.array(ConceptEdge) }),
  landscapeGraph: z.object({ nodes: z.array(LandscapeNode), edges: z.array(LandscapeEdge) }),
  evidence: z.array(Evidence),
});

export type BriefDoc = z.infer<typeof BriefDocSchema>;
