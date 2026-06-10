import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AtlasListPanel } from "./AtlasListPanel";
import { CameraAltitudesTable } from "./CameraAltitudesTable";
import { buildAtlasView, searchAtlas } from "../adapters/atlas";
import { sampleDoc } from "../test-utils/sample";

const view = buildAtlasView(sampleDoc);

describe("searchAtlas", () => {
  it("matches names, techTags, and tags case-insensitively", () => {
    expect(searchAtlas(view, "zod").map((h) => h.id)).toContain("lm_validator");
    expect(searchAtlas(view, "ARCHIT").map((h) => h.id)).toContain("c_arch");
    expect(searchAtlas(view, "incremental").map((h) => h.kind)).toContain("landmark");
    expect(searchAtlas(view, "")).toEqual([]);
  });
});

describe("AtlasListPanel", () => {
  it("switches to the Search tab, filters, and selects a hit", () => {
    const onSelect = vi.fn();
    render(<AtlasListPanel view={view} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("tab", { name: "Search" }));
    fireEvent.change(screen.getByLabelText("Search the atlas"), { target: { value: "wizard" } });
    fireEvent.click(screen.getByText("Depth wizard"));
    expect(onSelect).toHaveBeenCalledWith("lm_wizard");
  });

  it("mirrors the selection in a mini card", () => {
    render(<AtlasListPanel view={view} selectedId="lm_validator" onSelect={() => {}} />);
    expect(screen.getByTestId("atlas-mini-card")).toHaveTextContent("Schema validator");
    expect(screen.getByTestId("atlas-mini-card")).toHaveTextContent("Evidence (1)");
  });
});

describe("CameraAltitudesTable expansion", () => {
  it("expands a continent's cities and supports Open all", () => {
    const onSelect = vi.fn();
    render(<CameraAltitudesTable view={view} onSelect={onSelect} />);
    expect(screen.queryByText("Deterministic core")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Toggle Architecture cities"));
    fireEvent.click(screen.getByText("Deterministic core"));
    expect(onSelect).toHaveBeenCalledWith("city_core");
    fireEvent.click(screen.getByText("Open all"));
    expect(screen.getByText("Sharing & export")).toBeInTheDocument();
    expect(screen.getByText("Close all")).toBeInTheDocument();
  });
});
