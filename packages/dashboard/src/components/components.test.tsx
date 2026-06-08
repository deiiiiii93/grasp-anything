import { render, screen } from "@testing-library/react";
import { EvidenceChips } from "./EvidenceChips";
import { BriefCard } from "./BriefCard";
import { Header } from "./Header";
import type { BriefCardVM, EvidenceChip, SignalsVM } from "../adapters/brief";

const chips: EvidenceChip[] = [
  { id: "ev1", claim: "Ships a dashboard", source: "README", url: "https://x", verified: true },
  { id: "ev2", claim: "Guessed", source: "inference", verified: false },
];

describe("EvidenceChips", () => {
  it("renders one chip per evidence with verified/inferred styling", () => {
    render(<EvidenceChips evidence={chips} />);
    const rendered = screen.getAllByTestId("evidence-chip");
    expect(rendered).toHaveLength(2);
    expect(rendered[0]).toHaveClass("verified");
    expect(rendered[1]).toHaveClass("inferred");
    expect(rendered[0]).toHaveAttribute("title", expect.stringContaining("Ships a dashboard"));
    expect(rendered[0]).toHaveAttribute("aria-label", expect.stringContaining("verified"));
    expect(rendered[1]).toHaveAttribute("aria-label", expect.stringContaining("inferred"));
  });

  it("renders nothing when there is no evidence", () => {
    const { container } = render(<EvidenceChips evidence={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("BriefCard", () => {
  const card: BriefCardVM = { key: "why", title: "Why It Wins", body: "Because reasons.", evidence: chips };

  it("renders the title, body, key-scoped class, and chips", () => {
    render(<BriefCard card={card} />);
    expect(screen.getByText("Why It Wins")).toBeInTheDocument();
    expect(screen.getByText("Because reasons.")).toBeInTheDocument();
    expect(screen.getByTestId("card-why")).toHaveClass("card-why");
    expect(screen.getAllByTestId("evidence-chip")).toHaveLength(2);
  });
});

describe("Header", () => {
  const signals: SignalsVM = {
    repo: "owner/repo",
    url: "https://github.com/owner/repo",
    takeaway: "Worth it.",
    stars: 1200,
    language: "TypeScript",
    depth: "skim",
    broadness: "web",
  };

  it("renders repo link, verdict, and signal chips", () => {
    render(<Header signals={signals} />);
    const link = screen.getByRole("link", { name: "owner/repo" });
    expect(link).toHaveAttribute("href", "https://github.com/owner/repo");
    expect(screen.getByText("Worth it.")).toBeInTheDocument();
    expect(screen.getByText("★ 1,200")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("depth: skim")).toBeInTheDocument();
    expect(screen.getByText("scope: web")).toBeInTheDocument();
  });

  it("renders the repo as plain text (no link) when url is absent", () => {
    render(<Header signals={{ ...signals, url: undefined }} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("owner/repo")).toBeInTheDocument();
  });
});
