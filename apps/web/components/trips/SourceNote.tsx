import React from "react";

/** Readable source links in planning notes; no fetch or implicit navigation. */
export function SourceNote({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https:\/\/[^\s<>]+)/g).map((part, index) => {
        if (!part.startsWith("https://")) return part;
        const url = part.replace(/[;.,]+$/, "");
        const suffix = part.slice(url.length);
        try {
          const parsed = new URL(url);
          if (parsed.username || parsed.password) return part;
          return (
            <React.Fragment key={index}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
                aria-label={`Source: ${parsed.hostname}${parsed.pathname}`}
              >
                {parsed.hostname}
              </a>
              {suffix}
            </React.Fragment>
          );
        } catch {
          return part;
        }
      })}
    </>
  );
}
