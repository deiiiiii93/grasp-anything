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

  it("toggles fullscreen on the globe stage (CSS fallback in jsdom) and exits on Esc", () => {
    render(<App doc={sampleDoc} />);
    const stage = screen.getByTestId("atlas-stage");
    expect(stage.className).not.toContain("stage-fullscreen");
    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    expect(stage.className).toContain("stage-fullscreen");
    expect(screen.getByRole("button", { name: "Exit full screen" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(stage.className).not.toContain("stage-fullscreen");
  });

  it("the context card is always on the stage; the voyage control floats in on fullscreen", () => {
    render(<App doc={sampleDoc} />);
    const stage = screen.getByTestId("atlas-stage");
    // Detail card is always on the stage (liquid-glass overlay).
    const detail = within(stage).getByTestId("atlas-detail");
    expect(detail).toBeInTheDocument();
    // Voyage button only floats into the stage in fullscreen.
    expect(within(stage).queryByRole("button", { name: "▶ Voyage" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    fireEvent.click(within(stage).getByRole("button", { name: "▶ Voyage" }));
    expect(within(stage).getByTestId("voyage-overlay")).toBeInTheDocument();
    // The detail card mirrors the voyage's first navigation once it advances.
    fireEvent.click(within(stage).getByLabelText("Next stop"));
    expect(within(detail).getByRole("heading")).toHaveTextContent("Architecture");
  });

  it("uses the native Fullscreen API when the stage supports it", () => {
    const request = vi.fn().mockResolvedValue(undefined);
    (HTMLDivElement.prototype as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen = request;
    try {
      render(<App doc={sampleDoc} />);
      fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
      expect(request).toHaveBeenCalled();
      // Native path: no CSS fallback class.
      expect(screen.getByTestId("atlas-stage").className).not.toContain("stage-fullscreen");
    } finally {
      delete (HTMLDivElement.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen;
    }
  });

  it("toggles light/dark theme on <html> and persists it", () => {
    localStorage.removeItem("grasp-theme");
    render(<App doc={sampleDoc} />);
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: /switch to light theme/i }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("grasp-theme")).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: /switch to dark theme/i }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
