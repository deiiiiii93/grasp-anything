import { render, screen } from "@testing-library/react";
import { App } from "./App";
import { sampleDoc } from "./test-utils/sample";

describe("App", () => {
  it("renders the repo name", () => {
    render(<App doc={sampleDoc} />);
    expect(screen.getByText("Lum1104/Understand-Anything")).toBeInTheDocument();
  });
});
