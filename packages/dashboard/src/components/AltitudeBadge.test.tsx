import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AltitudeBadge } from "./AltitudeBadge";
import { buildAtlasView } from "../adapters/atlas";
import { sampleDoc } from "../test-utils/sample";

const view = buildAtlasView(sampleDoc);

describe("AltitudeBadge", () => {
  it("shows the orbit caption when nothing is selected", () => {
    render(<AltitudeBadge view={view} selectedId={null} />);
    expect(screen.getByTestId("altitude-badge")).toHaveTextContent("Orbit");
    expect(screen.getByTestId("altitude-badge")).toHaveTextContent("Whole product · Six dimensions");
  });
  it("names the focused continent and landmark", () => {
    const { rerender } = render(<AltitudeBadge view={view} selectedId="c_arch" />);
    expect(screen.getByTestId("altitude-badge")).toHaveTextContent("Architecture · Asia");
    rerender(<AltitudeBadge view={view} selectedId="lm_validator" />);
    expect(screen.getByTestId("altitude-badge")).toHaveTextContent("Schema validator");
  });
});
