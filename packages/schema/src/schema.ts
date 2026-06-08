import { z } from "zod";

export const conceptNodeTypes = ["problem", "idea", "mechanism", "outcome", "feature"] as const;
export const conceptEdgeTypes = ["addresses", "composedOf", "enables", "produces"] as const;
export const landscapeNodeTypes = ["self", "alternative", "category"] as const;
export const landscapeEdgeTypes = ["competesWith", "sharesApproach", "alternativeTo"] as const;

export type ConceptNodeType = (typeof conceptNodeTypes)[number];
export type ConceptEdgeType = (typeof conceptEdgeTypes)[number];
export type LandscapeNodeType = (typeof landscapeNodeTypes)[number];
export type LandscapeEdgeType = (typeof landscapeEdgeTypes)[number];

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

// Keys must mirror Brief's prose fields (idea/problem/why/how/takeaway).
// Each maps a prose card to the evidence ids that back it.
const BriefEvidence = z
  .object({
    idea: z.array(z.string()).optional(),
    problem: z.array(z.string()).optional(),
    why: z.array(z.string()).optional(),
    how: z.array(z.string()).optional(),
    takeaway: z.array(z.string()).optional(),
  })
  .optional();

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
  evidence: BriefEvidence,
});

export const BriefDocSchema = z
  .object({
    meta: Meta,
    brief: Brief,
    conceptGraph: z.object({ nodes: z.array(ConceptNode), edges: z.array(ConceptEdge) }),
    landscapeGraph: z.object({ nodes: z.array(LandscapeNode), edges: z.array(LandscapeEdge) }),
    evidence: z.array(Evidence),
  })
  .superRefine((doc, ctx) => {
    const ideaCount = doc.conceptGraph.nodes.filter((n) => n.type === "idea").length;
    if (ideaCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `conceptGraph must have exactly one 'idea' node, found ${ideaCount}`,
        path: ["conceptGraph", "nodes"],
      });
    }

    const selfCount = doc.landscapeGraph.nodes.filter((n) => n.type === "self").length;
    if (selfCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `landscapeGraph must have exactly one 'self' node, found ${selfCount}`,
        path: ["landscapeGraph", "nodes"],
      });
    }

    const conceptIds = new Set(doc.conceptGraph.nodes.map((n) => n.id));
    doc.conceptGraph.edges.forEach((e, i) => {
      if (!conceptIds.has(e.source)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `concept edge '${e.id}' source '${e.source}' not found`, path: ["conceptGraph", "edges", i, "source"] });
      }
      if (!conceptIds.has(e.target)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `concept edge '${e.id}' target '${e.target}' not found`, path: ["conceptGraph", "edges", i, "target"] });
      }
    });

    const landIds = new Set(doc.landscapeGraph.nodes.map((n) => n.id));
    doc.landscapeGraph.edges.forEach((e, i) => {
      if (!landIds.has(e.source)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `landscape edge '${e.id}' source '${e.source}' not found`, path: ["landscapeGraph", "edges", i, "source"] });
      }
      if (!landIds.has(e.target)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `landscape edge '${e.id}' target '${e.target}' not found`, path: ["landscapeGraph", "edges", i, "target"] });
      }
    });

    const evidenceIds = new Set(doc.evidence.map((e) => e.id));
    const checkEvidence = (ids: string[], basePath: (string | number)[]) => {
      ids.forEach((id, j) => {
        if (!evidenceIds.has(id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `references missing evidence '${id}'`, path: [...basePath, j] });
        }
      });
    };
    doc.conceptGraph.nodes.forEach((n, i) => checkEvidence(n.evidenceIds, ["conceptGraph", "nodes", i, "evidenceIds"]));
    doc.landscapeGraph.nodes.forEach((n, i) => checkEvidence(n.evidenceIds, ["landscapeGraph", "nodes", i, "evidenceIds"]));

    if (doc.brief.evidence) {
      for (const [key, ids] of Object.entries(doc.brief.evidence)) {
        checkEvidence(ids ?? [], ["brief", "evidence", key]);
      }
    }

    doc.landscapeGraph.nodes.forEach((n, i) => {
      if (n.type === "alternative" && (!n.name || !n.url)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `alternative node '${n.id}' requires both name and url`, path: ["landscapeGraph", "nodes", i] });
      }
      if (n.type === "self" && !n.name) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `self node '${n.id}' requires a name`, path: ["landscapeGraph", "nodes", i] });
      }
      if (n.type === "category" && !n.label) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `category node '${n.id}' requires a label`, path: ["landscapeGraph", "nodes", i] });
      }
    });
  });

export type BriefDoc = z.infer<typeof BriefDocSchema>;

export {
  ConceptNode as ConceptNodeSchema,
  ConceptEdge as ConceptEdgeSchema,
  LandscapeNode as LandscapeNodeSchema,
  LandscapeEdge as LandscapeEdgeSchema,
  Evidence as EvidenceSchema,
  Meta as MetaSchema,
};
