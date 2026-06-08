import { describe, it, expect } from "vitest";
import { SCHEMA_VERSION } from "../index";

describe("schema package", () => {
  it("exposes a version", () => {
    expect(SCHEMA_VERSION).toBe("0.1.0");
  });
});
