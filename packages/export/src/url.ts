/**
 * A brief's URLs come from an LLM reading an UNTRUSTED repository, so they must be
 * treated as hostile before they land in HTML/Markdown opened in a browser.
 * `safeHref` allows only http/https/mailto and re-normalizes via the URL parser
 * (percent-encoding any attribute-breaking characters); anything else (e.g.
 * `javascript:`, `data:`, or an unparseable string) collapses to "#".
 */
export function safeHref(url: string): string {
  try {
    const parsed = new URL(url);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? parsed.href : "#";
  } catch {
    return "#";
  }
}
