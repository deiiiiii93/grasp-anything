import { z } from "zod";

export const landscapeNodeTypes = ["self", "alternative", "category"] as const;
export const landscapeEdgeTypes = ["competesWith", "sharesApproach", "alternativeTo"] as const;

export const atlasDomains = [
  "architecture", "modules", "workflows",
  "businessFlows", "techSelection", "uiUxTaste",
] as const;
export const flowEdgeTypes = [
  "calls", "streams", "persists", "fansOut", "reviews", "next",
] as const;
export type AtlasDomain = (typeof atlasDomains)[number];
export type FlowEdgeType = (typeof flowEdgeTypes)[number];

export type LandscapeNodeType = (typeof landscapeNodeTypes)[number];
export type LandscapeEdgeType = (typeof landscapeEdgeTypes)[number];

const Landmark = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  detail: z.string().optional(),
  whyItMatters: z.string().optional(),
  techTag: z.string().optional(),
  tags: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
});
const City = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  summary: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
  landmarks: z.array(Landmark).default([]),
});
const Flow = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.enum(flowEdgeTypes),
  label: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
});
const Continent = z.object({
  id: z.string().min(1),
  domain: z.enum(atlasDomains),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  evidenceIds: z.array(z.string()).default([]),
  cities: z.array(City).default([]),
  flows: z.array(Flow).default([]),
});
const Atlas = z.object({ continents: z.array(Continent).default([]) });

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
    atlas: Atlas,
    landscapeGraph: z.object({ nodes: z.array(LandscapeNode), edges: z.array(LandscapeEdge) }),
    evidence: z.array(Evidence),
  })
  .superRefine((doc, ctx) => {
    const selfCount = doc.landscapeGraph.nodes.filter((n) => n.type === "self").length;
    if (selfCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `landscapeGraph must have exactly one 'self' node, found ${selfCount}`,
        path: ["landscapeGraph", "nodes"],
      });
    }

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

    // --- Atlas referential integrity ---
    const seenIds = new Set<string>();
    const seenDomains = new Set<string>();
    const dupId = (id: string, path: (string | number)[]) => {
      if (seenIds.has(id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate id '${id}'`, path });
      }
      seenIds.add(id);
    };
    doc.atlas.continents.forEach((cont, ci) => {
      dupId(cont.id, ["atlas", "continents", ci, "id"]);
      if (seenDomains.has(cont.domain)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `continent domain '${cont.domain}' must be unique`, path: ["atlas", "continents", ci, "domain"] });
      }
      seenDomains.add(cont.domain);
      checkEvidence(cont.evidenceIds, ["atlas", "continents", ci, "evidenceIds"]);
      const localIds = new Set<string>();
      cont.cities.forEach((city, cyi) => {
        dupId(city.id, ["atlas", "continents", ci, "cities", cyi, "id"]);
        localIds.add(city.id);
        checkEvidence(city.evidenceIds, ["atlas", "continents", ci, "cities", cyi, "evidenceIds"]);
        city.landmarks.forEach((lm, li) => {
          dupId(lm.id, ["atlas", "continents", ci, "cities", cyi, "landmarks", li, "id"]);
          localIds.add(lm.id);
          checkEvidence(lm.evidenceIds, ["atlas", "continents", ci, "cities", cyi, "landmarks", li, "evidenceIds"]);
        });
      });
      cont.flows.forEach((fl, fi) => {
        dupId(fl.id, ["atlas", "continents", ci, "flows", fi, "id"]);
        checkEvidence(fl.evidenceIds, ["atlas", "continents", ci, "flows", fi, "evidenceIds"]);
        for (const [end, key] of [[fl.source, "source"], [fl.target, "target"]] as const) {
          if (!localIds.has(end))
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `flow '${fl.id}' ${key} '${end}' not a city/landmark in this continent`, path: ["atlas", "continents", ci, "flows", fi, key] });
        }
      });
    });
  });

export type BriefDoc = z.infer<typeof BriefDocSchema>;

export {
  LandscapeNode as LandscapeNodeSchema,
  LandscapeEdge as LandscapeEdgeSchema,
  Evidence as EvidenceSchema,
  Meta as MetaSchema,
  Landmark as LandmarkSchema,
  City as CitySchema,
  Flow as FlowSchema,
  Continent as ContinentSchema,
  Atlas as AtlasSchema,
};
