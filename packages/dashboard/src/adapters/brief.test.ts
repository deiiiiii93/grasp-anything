import { buildCards, buildSignals, resolveEvidence } from "./brief";
import { sampleDoc } from "../test-utils/sample";

describe("resolveEvidence", () => {
  it("resolves known ids to chips", () => {
    const chips = resolveEvidence(sampleDoc, ["ev1"]);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ id: "ev1", source: "README", verified: true });
  });

  it("ignores unknown ids", () => {
    expect(resolveEvidence(sampleDoc, ["nope"])).toEqual([]);
  });

  it("preserves the inferred (verified: false) flag", () => {
    const doc = {
      ...sampleDoc,
      evidence: [{ id: "evx", claim: "best guess", source: "inference", verified: false }],
    };
    const chips = resolveEvidence(doc, ["evx"]);
    expect(chips[0].verified).toBe(false);
  });
});

describe("buildCards", () => {
  it("returns five cards in fixed order with titles and bodies", () => {
    const cards = buildCards(sampleDoc);
    expect(cards.map((c) => c.key)).toEqual(["idea", "problem", "why", "how", "takeaway"]);
    expect(cards.map((c) => c.title)).toEqual([
      "Core Idea",
      "Problem",
      "Why It Wins",
      "How It Works",
      "Takeaway",
    ]);
    expect(cards[0].body).toBe(sampleDoc.brief.idea);
  });

  it("attaches resolved evidence to the why card and leaves others empty", () => {
    const cards = buildCards(sampleDoc);
    const why = cards.find((c) => c.key === "why")!;
    expect(why.evidence.map((e) => e.id)).toEqual(["ev1"]);
    const idea = cards.find((c) => c.key === "idea")!;
    expect(idea.evidence).toEqual([]);
  });
});

describe("buildSignals", () => {
  it("extracts repo, takeaway, and meta signals", () => {
    const s = buildSignals(sampleDoc);
    expect(s).toMatchObject({
      repo: "Lum1104/Understand-Anything",
      takeaway: sampleDoc.brief.takeaway,
      stars: 1200,
      language: "TypeScript",
      depth: "skim",
      broadness: "web",
    });
  });
});
