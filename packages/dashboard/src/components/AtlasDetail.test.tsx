import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AtlasDetail } from "./AtlasDetail";
import type { ContinentView, CityView, LandmarkView } from "../adapters/atlas";

const cont: ContinentView = { id: "c", domain: "workflows", title: "Workflows", summary: "How runtime flows.", continentName: "North America", motif: "Statue of Liberty", lat: 0, lng: 0, color: "#5aa9f0", cityCount: 1, landmarkCount: 0, evidence: [] };
const city: CityView = { id: "ci", continentId: "c", name: "Ingest", summary: "Reads input.", lat: 0, lng: 0, color: "#5aa9f0", evidence: [] };
const lm: LandmarkView = { id: "l", cityId: "ci", continentId: "c", name: "Parser", detail: "Parses.", whyItMatters: "Determinism.", techTag: "Zod", tags: ["x"], lat: 0, lng: 0, color: "#5aa9f0", evidence: [] };

describe("AtlasDetail per altitude", () => {
  it("shows the empty prompt when nothing is selected", () => {
    render(<AtlasDetail node={null} />);
    expect(screen.getByText(/select a/i)).toBeInTheDocument();
  });
  it("renders a continent summary", () => {
    render(<AtlasDetail node={{ kind: "continent", continent: cont }} />);
    expect(screen.getByText("How runtime flows.")).toBeInTheDocument();
    expect(screen.getByText(/continent/i)).toBeInTheDocument();
  });
  it("renders the continent's story card (concept + lesson + motif art)", () => {
    render(<AtlasDetail node={{ kind: "continent", continent: cont }} />);
    expect(screen.getByText(/French design, American made/)).toBeInTheDocument();
    expect(screen.getByText(/standardized handoff/i)).toBeInTheDocument();
    expect(screen.getByAltText("Statue of Liberty")).toHaveAttribute("src", "./atlas/landmarks/workflows.png");
  });
  it("renders a city summary", () => {
    render(<AtlasDetail node={{ kind: "city", city }} />);
    expect(screen.getByText("Reads input.")).toBeInTheDocument();
  });
  it("renders the full landmark (why it matters)", () => {
    render(<AtlasDetail node={{ kind: "landmark", landmark: lm }} />);
    expect(screen.getByText("Determinism.")).toBeInTheDocument();
  });
});
