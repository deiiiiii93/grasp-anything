import { describe, it, expect } from "vitest";
import { PIPELINE_VERSION } from "../index";
import { SCHEMA_VERSION } from "@grasp/schema";

describe("pipeline package", () => {
  it("exposes its version", () => {
    expect(PIPELINE_VERSION).toBe("0.1.0");
  });

  it("can import the schema workspace", () => {
    expect(SCHEMA_VERSION).toBe("0.1.0");
  });
});
