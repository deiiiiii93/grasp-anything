import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { VoyageOverlay } from "./VoyageOverlay";
import type { VoyageStop } from "../adapters/voyage";

const stops: VoyageStop[] = [
  { id: null, kind: "orbit", title: "Product Atlas", body: "intro" },
  { id: "c1", kind: "continent", chapter: 1, title: "Architecture", subtitle: "Asia · Great Wall", concept: "One brick.", body: "layers" },
  { id: "l1", kind: "landmark", chapter: 1, title: "Validator", subtitle: "Zod", body: "the contract" },
  { id: null, kind: "outro", title: "End of the voyage", body: "bye" },
];

afterEach(() => vi.useRealTimers());

describe("VoyageOverlay", () => {
  it("navigates to the first stop on mount and steps with Next/Prev", () => {
    const onNavigate = vi.fn();
    render(<VoyageOverlay stops={stops} onNavigate={onNavigate} onExit={() => {}} />);
    expect(onNavigate).toHaveBeenCalledWith(null);
    expect(screen.getByText("Product Atlas")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Next stop"));
    expect(onNavigate).toHaveBeenCalledWith("c1");
    expect(screen.getByText("Chapter 1")).toBeInTheDocument();
    expect(screen.getByText(/One brick/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Previous stop"));
    expect(screen.getByText("Product Atlas")).toBeInTheDocument();
  });

  it("auto-advances while playing and stops at the outro", () => {
    vi.useFakeTimers();
    const onNavigate = vi.fn();
    render(<VoyageOverlay stops={stops} onNavigate={onNavigate} onExit={() => {}} />);
    act(() => vi.advanceTimersByTime(7000 * 5));
    expect(screen.getByText("End of the voyage")).toBeInTheDocument();
    // No looping: more time does not move past the outro.
    act(() => vi.advanceTimersByTime(7000 * 2));
    expect(screen.getByText("End of the voyage")).toBeInTheDocument();
  });

  it("pause halts auto-advance; exit calls onExit", () => {
    vi.useFakeTimers();
    const onExit = vi.fn();
    render(<VoyageOverlay stops={stops} onNavigate={() => {}} onExit={onExit} />);
    fireEvent.click(screen.getByLabelText("Pause"));
    act(() => vi.advanceTimersByTime(7000 * 3));
    expect(screen.getByText("Product Atlas")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("End voyage"));
    expect(onExit).toHaveBeenCalled();
  });
});
