import { render, screen, fireEvent, within } from "@testing-library/react";
import { ConceptGraph } from "./ConceptGraph";
import { sampleDoc } from "../test-utils/sample";

describe("ConceptGraph", () => {
  it("renders a node element for every concept node", () => {
    render(<ConceptGraph doc={sampleDoc} />);
    for (const n of sampleDoc.conceptGraph.nodes) {
      expect(screen.getByTestId(`concept-node-${n.id}`)).toBeInTheDocument();
    }
  });

  it("defaults the detail panel to the idea node", () => {
    render(<ConceptGraph doc={sampleDoc} />);
    const detail = screen.getByTestId("concept-detail");
    expect(within(detail).getByRole("heading")).toHaveTextContent("Repo as an interactive knowledge graph");
  });

  it("selects a node on click and shows its detail + evidence", () => {
    render(<ConceptGraph doc={sampleDoc} />);
    fireEvent.click(screen.getByTestId("concept-node-o1"));
    const detail = screen.getByTestId("concept-detail");
    expect(within(detail).getByRole("heading")).toHaveTextContent("Interactive architecture dashboard");
    expect(within(detail).getAllByTestId("evidence-chip")).toHaveLength(1);
  });

  it("selects a node via keyboard (Enter)", () => {
    render(<ConceptGraph doc={sampleDoc} />);
    fireEvent.keyDown(screen.getByTestId("concept-node-m1"), { key: "Enter" });
    const detail = screen.getByTestId("concept-detail");
    expect(within(detail).getByRole("heading")).toHaveTextContent("LLM agents emit a validated JSON graph");
  });

  it("dims non-neighbors when a node is hovered (idea1 → m1 stays lit, o1 dims)", () => {
    render(<ConceptGraph doc={sampleDoc} />);
    fireEvent.mouseEnter(screen.getByTestId("concept-node-idea1"));
    // m1 is a direct neighbor of idea1; o1 is not (it hangs off m1).
    expect(screen.getByTestId("concept-node-m1").getAttribute("class")).not.toContain("dim");
    expect(screen.getByTestId("concept-node-o1").getAttribute("class")).toContain("dim");
    // Leaving clears the highlight.
    fireEvent.mouseLeave(screen.getByTestId("concept-node-idea1"));
    expect(screen.getByTestId("concept-node-o1").getAttribute("class")).not.toContain("dim");
  });
});
