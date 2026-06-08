import { describe, it, expect } from "vitest";
import { validateBrief } from "@grasp/schema";
import sample from "@grasp/schema/sample-brief.json";
import { safeHref } from "../url";
import { briefToPrintHtml } from "../printHtml";
import { briefToMarkdown } from "../markdown";
import { conceptToMermaid } from "../mermaid";

describe("safeHref", () => {
  it("passes http/https/mailto through", () => {
    expect(safeHref("https://x.com/a")).toBe("https://x.com/a");
    expect(safeHref("http://x.com")).toBe("http://x.com/");
    expect(safeHref("mailto:a@b.com")).toBe("mailto:a@b.com");
  });

  it("neutralizes dangerous schemes and junk to #", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBe("#");
    expect(safeHref("not a url")).toBe("#");
  });
});

// A brief is built by an LLM reading an UNTRUSTED repo, so its url fields are hostile.
describe("export XSS hardening", () => {
  function poison() {
    const d = JSON.parse(JSON.stringify(sample));
    d.meta.url = "javascript:alert(1)";
    d.evidence[0].url = 'https://x/"onmouseover="alert(1)';
    return validateBrief(d).data!;
  }

  it("print-HTML drops javascript: urls and never breaks out of the href attribute", () => {
    const html = briefToPrintHtml(poison());
    expect(html).not.toContain("javascript:alert(1)");
    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).not.toContain('href="https://x/"');
  });

  it("Markdown neutralizes javascript: links too", () => {
    const d = JSON.parse(JSON.stringify(sample));
    d.evidence[0].url = "javascript:alert(1)";
    const md = briefToMarkdown(validateBrief(d).data!);
    expect(md).not.toContain("javascript:alert(1)");
  });

  it("Markdown escapes link-breaking characters in evidence links", () => {
    const d = JSON.parse(JSON.stringify(sample));
    d.evidence[0].url = "https://x.com/a)b";
    d.evidence[0].source = "src]injected";
    const md = briefToMarkdown(validateBrief(d).data!);
    expect(md).toContain("%29"); // the ")" in the url is percent-encoded
    expect(md).toContain("src\\]injected"); // the "]" in the link text is escaped
  });

  it("Mermaid escapes angle brackets in untrusted node labels", () => {
    const d = JSON.parse(JSON.stringify(sample));
    d.conceptGraph.nodes[0].label = '"><script>alert(1)</script>';
    const out = conceptToMermaid(validateBrief(d).data!);
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });
});
