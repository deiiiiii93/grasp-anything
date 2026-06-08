import type { BriefDoc } from "@grasp/schema";

export interface EvidenceChip {
  id: string;
  claim: string;
  source: string;
  url?: string;
  verified: boolean;
}

export type BriefKey = "idea" | "problem" | "why" | "how" | "takeaway";

export interface BriefCardVM {
  key: BriefKey;
  title: string;
  body: string;
  evidence: EvidenceChip[];
}

export interface SignalsVM {
  repo: string;
  url?: string;
  takeaway: string;
  stars?: number;
  language?: string;
  depth: string;
  broadness: string;
}

const CARD_ORDER: BriefKey[] = ["idea", "problem", "why", "how", "takeaway"];

const CARD_TITLES: Record<BriefKey, string> = {
  idea: "Core Idea",
  problem: "Problem",
  why: "Why It Wins",
  how: "How It Works",
  takeaway: "Takeaway",
};

export function resolveEvidence(doc: BriefDoc, ids: string[]): EvidenceChip[] {
  const byId = new Map(doc.evidence.map((e) => [e.id, e]));
  const chips: EvidenceChip[] = [];
  for (const id of ids) {
    const e = byId.get(id);
    if (e) {
      chips.push({ id: e.id, claim: e.claim, source: e.source, url: e.url, verified: e.verified });
    }
  }
  return chips;
}

export function buildCards(doc: BriefDoc): BriefCardVM[] {
  const evidenceMap: NonNullable<BriefDoc["brief"]["evidence"]> = doc.brief.evidence ?? {};
  return CARD_ORDER.map((key) => ({
    key,
    title: CARD_TITLES[key],
    body: doc.brief[key],
    evidence: resolveEvidence(doc, evidenceMap[key] ?? []),
  }));
}

export function buildSignals(doc: BriefDoc): SignalsVM {
  return {
    repo: doc.meta.repo,
    url: doc.meta.url,
    takeaway: doc.brief.takeaway,
    stars: doc.meta.signals.stars,
    language: doc.meta.signals.language,
    depth: doc.meta.depth,
    broadness: doc.meta.broadness,
  };
}
