import { render, screen } from "@testing-library/react";
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
