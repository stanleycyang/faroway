import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SourceNote } from "@/components/trips/SourceNote";
it("renders a compact source link while preserving its exact URL and punctuation", () => {
  const html = renderToStaticMarkup(
    <SourceNote text="Source: https://example.com/menu.pdf?v=123; check hours." />,
  );
  expect(html).toContain('href="https://example.com/menu.pdf?v=123"');
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).toContain(">example.com</a>; check hours.");
});
it.each([
  "javascript:alert(1)",
  "https://user:password@example.com",
  "https://%",
  "http://example.com",
])("does not turn unsafe or unsupported text into a link: %s", (text) => {
  const html = renderToStaticMarkup(<SourceNote text={text} />);
  expect(html).not.toContain("<a ");
});
