import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportMenu } from "./ExportMenu";
import { sampleDoc } from "../test-utils/sample";

// jsdom implements neither createObjectURL nor anchor-click navigation —
// capture the Blob and the download filename instead. (jsdom Blobs also lack
// .text(); read through FileReader.)
const readBlob = (b: Blob) =>
  new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsText(b);
  });
let blobs: Blob[];
beforeEach(() => {
  blobs = [];
  URL.createObjectURL = vi.fn((b: Blob) => {
    blobs.push(b);
    return "blob:grasp-test";
  });
  URL.revokeObjectURL = vi.fn();
});

describe("ExportMenu", () => {
  it("opens a menu with the three artifacts", () => {
    render(<ExportMenu doc={sampleDoc} />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    for (const label of ["Report — Markdown", "Print page — HTML", "Brief data — JSON"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("downloads report.md containing the brief markdown", async () => {
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    render(<ExportMenu doc={sampleDoc} />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(screen.getByText("Report — Markdown"));
    expect(clicks).toEqual(["report.md"]);
    const text = await readBlob(blobs[0]);
    expect(text).toContain(`# ${sampleDoc.meta.repo}`);
    expect(text).toContain("## How it works");
    // Menu closes after the download.
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("downloads the raw brief JSON round-trippably", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ExportMenu doc={sampleDoc} />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(screen.getByText("Brief data — JSON"));
    const parsed = JSON.parse(await readBlob(blobs[0]));
    expect(parsed.meta.repo).toBe(sampleDoc.meta.repo);
    expect(parsed.atlas.continents.length).toBe(6);
  });
});
