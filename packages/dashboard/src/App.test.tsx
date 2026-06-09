import { render, screen, fireEvent, within } from "@testing-library/react";
import { vi } from "vitest";
import { App } from "./App";
import { sampleDoc } from "./test-utils/sample";

// jsdom has no WebGL; mock globeImpl so AtlasGlobe falls back to the outline.
vi.mock("./components/globeImpl", () => ({ GlobeImpl: () => null, webglAvailable: () => false }));

describe("App", () => {
  it("shows the four top-nav tabs and defaults to Atlas", () => {
    render(<App doc={sampleDoc} />);
    for (const t of ["Strategic", "Atlas", "Landscape", "Evidence"]) {
      expect(screen.getByRole("tab", { name: t })).toBeInTheDocument();
    }
    expect(screen.getByRole("tab", { name: "Atlas" })).toHaveAttribute("aria-selected", "true");
  });

  it("renders the Atlas zones: intro, globe/outline, detail, how-it-works", () => {
    render(<App doc={sampleDoc} />);
    expect(screen.getByTestId("atlas-intro")).toBeInTheDocument();
    expect(screen.getByTestId("atlas-detail")).toBeInTheDocument();
    expect(screen.getByTestId("how-it-works")).toBeInTheDocument();
    expect(screen.getByTestId("altitude-rail")).toBeInTheDocument();
  });

  it("selecting a landmark updates the breadcrumb and detail panel", () => {
    render(<App doc={sampleDoc} />);
    fireEvent.click(screen.getAllByTestId("outline-node-lm_validator")[0]);
    expect(screen.getByTestId("atlas-breadcrumb")).toHaveTextContent("Architecture");
    expect(within(screen.getByTestId("atlas-detail")).getByRole("heading")).toHaveTextContent("Schema validator");
  });

  it("switches to the Landscape tab", () => {
    render(<App doc={sampleDoc} />);
    fireEvent.click(screen.getByRole("tab", { name: "Landscape" }));
    expect(screen.getByTestId("landscape-graph")).toBeInTheDocument();
  });
});
