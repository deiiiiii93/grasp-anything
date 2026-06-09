import { render, screen, fireEvent, within } from "@testing-library/react";
import { useState } from "react";
import { AtlasOutline } from "./AtlasOutline";
import { AtlasDetail } from "./AtlasDetail";
import { buildAtlasView } from "../adapters/atlas";
import { sampleDoc } from "../test-utils/sample";

function Harness() {
  const view = buildAtlasView(sampleDoc);
  const [sel, setSel] = useState<string | null>(null);
  const landmark = view.landmarks.find((l) => l.id === sel) ?? null;
  return (
    <div>
      <AtlasOutline view={view} selectedId={sel} onSelect={setSel} />
      <AtlasDetail landmark={landmark} />
    </div>
  );
}

describe("AtlasOutline", () => {
  it("renders a button for every continent, city, and landmark", () => {
    render(<Harness />);
    expect(screen.getByTestId("outline-node-c_arch")).toBeInTheDocument();
    expect(screen.getByTestId("outline-node-city_core")).toBeInTheDocument();
    expect(screen.getByTestId("outline-node-lm_validator")).toBeInTheDocument();
  });

  it("clicking a landmark selects it and shows whyItMatters in the detail panel", () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("outline-node-lm_validator"));
    const detail = screen.getByTestId("atlas-detail");
    expect(within(detail).getByRole("heading")).toHaveTextContent("Schema validator");
    expect(within(detail).getByText(/trustworthy/)).toBeInTheDocument();
    expect(within(detail).getByText("Zod")).toBeInTheDocument();
  });

  it("selects a landmark via keyboard (Enter)", () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByTestId("outline-node-lm_react"), { key: "Enter" });
    expect(within(screen.getByTestId("atlas-detail")).getByRole("heading")).toHaveTextContent("React dashboard");
  });
});
