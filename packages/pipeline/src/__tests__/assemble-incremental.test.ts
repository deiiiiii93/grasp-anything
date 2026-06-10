import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import { assemble } from "../assemble";
import meta from "./fixtures/meta.json";
import essence from "./fixtures/essence.json";
import success from "./fixtures/success.json";
import landscape from "./fixtures/landscape.json";

const ANALYZED_AT = "2026-06-10T12:00:00Z"; // == meta.json analyzedAt
const OLD = "2026-01-01T00:00:00Z";

describe("assemble with per-stream updatedAt override", () => {
  it("defaults every stream to meta.analyzedAt when no override is given", () => {
    const r = assemble({ meta, essence, success, landscape });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.brief.updatedAt).toEqual({
      essence: ANALYZED_AT,
      success: ANALYZED_AT,
      landscape: ANALYZED_AT,
    });
  });

  it("preserves overridden streams and keeps the rest at meta.analyzedAt", () => {
    const r = assemble({
      meta,
      essence,
      success,
      landscape,
      updatedAt: { success: OLD, landscape: OLD },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.brief.updatedAt).toEqual({
      essence: ANALYZED_AT,
      success: OLD,
      landscape: OLD,
    });
    expect(validateBrief(r.doc).ok).toBe(true);
  });
});
