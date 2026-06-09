import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { AtlasGlobe } from "./AtlasGlobe";
import { buildAtlasView } from "../adapters/atlas";
import { sampleDoc } from "../test-utils/sample";

// jsdom has no WebGL; AtlasGlobe must detect that and render the outline fallback.
vi.mock("./globeImpl", () => ({ GlobeImpl: () => null, webglAvailable: () => false }));

describe("AtlasGlobe (no WebGL)", () => {
  it("renders the outline fallback when WebGL is unavailable", () => {
    const view = buildAtlasView(sampleDoc);
    render(<AtlasGlobe view={view} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("atlas-outline")).toBeInTheDocument();
    expect(screen.getByTestId("outline-node-lm_validator")).toBeInTheDocument();
  });

  it("selecting a node in the fallback bubbles up via onSelect", () => {
    const view = buildAtlasView(sampleDoc);
    const onSelect = vi.fn();
    render(<AtlasGlobe view={view} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("outline-node-lm_validator"));
    expect(onSelect).toHaveBeenCalledWith("lm_validator");
  });
});
