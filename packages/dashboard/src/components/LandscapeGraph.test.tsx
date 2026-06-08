import { render, screen, fireEvent, within } from "@testing-library/react";
import { LandscapeGraph } from "./LandscapeGraph";
import { sampleDoc } from "../test-utils/sample";

describe("LandscapeGraph", () => {
  it("renders a node for self and each alternative (not category)", () => {
    render(<LandscapeGraph doc={sampleDoc} />);
    expect(screen.getByTestId("landscape-node-self1")).toBeInTheDocument();
    expect(screen.getByTestId("landscape-node-alt1")).toBeInTheDocument();
    expect(screen.getByTestId("landscape-node-alt2")).toBeInTheDocument();
    expect(screen.queryByTestId("landscape-node-cat1")).toBeNull();
  });

  it("renders the category legend", () => {
    render(<LandscapeGraph doc={sampleDoc} />);
    const legend = screen.getByTestId("landscape-legend");
    expect(within(legend).getByText("Code comprehension tools")).toBeInTheDocument();
  });

  it("defaults the detail panel to the self node (no GitHub link)", () => {
    render(<LandscapeGraph doc={sampleDoc} />);
    const detail = screen.getByTestId("landscape-detail");
    expect(within(detail).getByRole("heading")).toHaveTextContent("Understand-Anything");
    expect(within(detail).queryByRole("link")).toBeNull();
  });

  it("selecting an alternative shows its differentiator and a GitHub link", () => {
    render(<LandscapeGraph doc={sampleDoc} />);
    fireEvent.click(screen.getByTestId("landscape-node-alt1"));
    const detail = screen.getByTestId("landscape-detail");
    expect(within(detail).getByRole("heading")).toHaveTextContent("Sourcegraph Cody");
    expect(within(detail).getByText(/Commercial, IDE-embedded/)).toBeInTheDocument();
    const link = within(detail).getByRole("link", { name: /View on GitHub/ });
    expect(link).toHaveAttribute("href", "https://github.com/sourcegraph/cody");
  });

  it("selects a node via keyboard (Space)", () => {
    render(<LandscapeGraph doc={sampleDoc} />);
    fireEvent.keyDown(screen.getByTestId("landscape-node-alt2"), { key: " " });
    const detail = screen.getByTestId("landscape-detail");
    expect(within(detail).getByRole("heading")).toHaveTextContent("CodeSee");
  });
});
