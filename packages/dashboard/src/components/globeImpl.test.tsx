import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { buildAtlasView } from "../adapters/atlas";
import { sampleDoc } from "../test-utils/sample";

const captured = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
vi.mock("react-globe.gl", async () => {
  const { forwardRef } = await import("react");
  return {
    default: forwardRef(function MockGlobe(props: Record<string, unknown>, _ref: unknown) {
      captured.props = props;
      return null;
    }),
  };
});

import { GlobeImpl } from "./globeImpl";

const view = buildAtlasView(sampleDoc);
const noop = () => {};

beforeEach(() => {
  captured.props = null;
  // world.geojson fetch stays in flight; polygons are decoration.
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});
afterEach(() => vi.unstubAllGlobals());

describe("GlobeImpl billboards", () => {
  it("renders sprite billboards for all three tiers when a city is selected", () => {
    render(<GlobeImpl view={view} selectedId="city_core" onSelect={noop} width={800} height={600} />);
    const cont = screen.getByTestId("bb-c_arch");
    expect(cont.className).toContain("atlas-bb-continent");
    expect(cont.querySelector("img")?.getAttribute("src")).toBe("./atlas/landmarks/architecture.png");
    const city = screen.getByTestId("bb-city_core");
    expect(city.className).toContain("atlas-bb-city");
    expect(city.querySelector("img")?.getAttribute("src")).toBe("./atlas/cities/architecture.png");
    const lm = screen.getByTestId("bb-lm_validator");
    expect(lm.className).toContain("atlas-bb-landmark");
    expect(lm.querySelector("img")?.getAttribute("src")).toBe("./atlas/pins/architecture.png");
  });

  it("landmark labels carry their deterministic stagger offset", () => {
    render(<GlobeImpl view={view} selectedId="city_core" onSelect={noop} width={800} height={600} />);
    const labels = ["bb-lm_validator", "bb-lm_assemble"].map(
      (id) => screen.getByTestId(id).querySelector(".atlas-bb-label") as HTMLElement,
    );
    expect(labels.map((l) => l.style.getPropertyValue("--stagger"))).toEqual(["0px", "14px"]);
  });

  it("clicking a billboard bubbles its id via onSelect", () => {
    const onSelect = vi.fn();
    render(<GlobeImpl view={view} selectedId="city_core" onSelect={onSelect} width={800} height={600} />);
    fireEvent.click(screen.getByTestId("bb-lm_validator"));
    expect(onSelect).toHaveBeenCalledWith("lm_validator");
  });

  it("a failed sprite collapses to a tier-colored dot, not a broken image", () => {
    render(<GlobeImpl view={view} selectedId={null} onSelect={noop} width={800} height={600} />);
    const btn = screen.getByTestId("bb-c_arch");
    fireEvent.error(btn.querySelector("img") as HTMLImageElement);
    expect(btn.className).toContain("atlas-bb-broken");
  });

  it("labelsData is retired — cities/landmarks no longer go through globe.gl labels", () => {
    render(<GlobeImpl view={view} selectedId="city_core" onSelect={noop} width={800} height={600} />);
    expect(captured.props).not.toBeNull();
    expect("labelsData" in (captured.props as object)).toBe(false);
  });

  it("the globe wears the night-atlas ocean and raised land alpha", () => {
    render(<GlobeImpl view={view} selectedId={null} onSelect={noop} width={800} height={600} />);
    expect(captured.props?.globeImageUrl).toBe("./atlas/ocean.jpg");
    const cap = captured.props?.polygonCapColor as (f: object) => string;
    // architecture/Asia is #e5687a; focused land alpha is now 0.55
    expect(cap({ properties: { continent: "Asia" } })).toBe("rgba(229, 104, 122, 0.55)");
  });

  it("falls back to earth-dark.jpg when the ocean texture is missing", async () => {
    class FailingImage {
      onerror: (() => void) | null = null;
      set src(_v: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal("Image", FailingImage);
    render(<GlobeImpl view={view} selectedId={null} onSelect={noop} width={800} height={600} />);
    await waitFor(() => expect(captured.props?.globeImageUrl).toBe("./earth-dark.jpg"));
  });

  it("compass rose runs at full strength while the world fetch is in flight", () => {
    render(<GlobeImpl view={view} selectedId={null} onSelect={noop} width={800} height={600} />);
    expect(screen.getByTestId("atlas-compass").className).toContain("atlas-compass-loading");
  });

  it("compass settles to ornament opacity once the fetch finishes (even on failure)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 404 })));
    render(<GlobeImpl view={view} selectedId={null} onSelect={noop} width={800} height={600} />);
    await waitFor(() =>
      expect(screen.getByTestId("atlas-compass").className).not.toContain("atlas-compass-loading"),
    );
  });
});
