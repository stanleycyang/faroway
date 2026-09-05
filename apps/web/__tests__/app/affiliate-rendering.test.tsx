import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import type { ReactNode } from "react";
import { StreamedSpecPreview } from "@/components/trips/StreamedSpecPreview";

const { renderToStaticMarkup } = createRequire(import.meta.url)(
  "react-dom/server",
) as {
  renderToStaticMarkup: (element: ReactNode) => string;
};

describe("affiliate rendering", () => {
  it.each(["ActivityCard", "BookingButton"])(
    "hides %s booking actions with legacy malformed attribution",
    (type) => {
      const url = "https://www.viator.com/tours/123?pid=faroway&mcid=click_old";
      const html = renderToStaticMarkup(
        <StreamedSpecPreview
          blocks={[
            {
              type,
              props: {
                id: "tour-1",
                name: "City Tour",
                label: "Book tour",
                bookingUrl: url,
                url,
                affiliatePartner: "viator",
              },
            },
          ]}
        />,
      );
      expect(html).not.toContain("/api/track/click");
      expect(html).not.toContain("Book tour");
      if (type === "ActivityCard") expect(html).toContain("City Tour");
    },
  );

  it("renders a tracked, disclosed action for a valid provider URL", () => {
    const html = renderToStaticMarkup(
      <StreamedSpecPreview
        blocks={[
          {
            type: "ActivityCard",
            props: {
              id: "tour-1",
              name: "City Tour",
              affiliatePartner: "viator",
              bookingUrl:
                "https://www.viator.com/tours/123?pid=P12345678&mcid=42383&medium=api",
            },
          },
        ]}
      />,
    );
    expect(html).toContain("/api/track/click?");
    expect(html).toContain("sponsored");
    expect(html).toContain("commission");
  });
});
