import { describe, it, expect } from "vitest";
import sample from "../../sample-brief.json";
import { BriefDocSchema } from "../schema";

describe("BriefDocSchema", () => {
  it("accepts the golden sample brief", () => {
    const result = BriefDocSchema.safeParse(sample);
    if (!result.success) {
      console.error(result.error.issues);
    }
    expect(result.success).toBe(true);
  });
});
