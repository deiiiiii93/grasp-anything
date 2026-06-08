import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "./App";
import { sampleDoc } from "./test-utils/sample";

describe("App", () => {
  it("renders the header repo name and all five brief cards", () => {
    render(<App doc={sampleDoc} />);
    expect(screen.getByText(sampleDoc.meta.repo)).toBeInTheDocument();
    for (const key of ["idea", "problem", "why", "how", "takeaway"]) {
      expect(screen.getByTestId(`card-${key}`)).toBeInTheDocument();
    }
  });

  it("renders the why card's evidence chip from the sample", () => {
    render(<App doc={sampleDoc} />);
    const whyCard = screen.getByTestId("card-why");
    expect(whyCard.querySelectorAll('[data-testid="evidence-chip"]')).toHaveLength(1);
  });
});

describe("App graphs", () => {
  it("shows the concept graph by default and switches to the landscape on tab click", () => {
    render(<App doc={sampleDoc} />);
    expect(screen.getByRole("tab", { name: "Concept map" })).toBeInTheDocument();
    expect(screen.getByTestId("concept-graph")).toBeInTheDocument();
    expect(screen.queryByTestId("landscape-graph")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Landscape" }));
    expect(screen.getByTestId("landscape-graph")).toBeInTheDocument();
    expect(screen.queryByTestId("concept-graph")).toBeNull();
    expect(screen.getByRole("tab", { name: "Landscape" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Concept map" })).toHaveAttribute("aria-selected", "false");
  });
});
