/**
 * Cold ISR failures can bypass App Router error boundaries. Keep this fallback
 * independent of app data, providers and hydration so document recovery works.
 */
export default function ServerError() {
  return (
    <main
      aria-labelledby="server-error-title"
      style={{
        maxWidth: "480px",
        margin: "15vh auto",
        padding: "24px",
        fontFamily: "system-ui, sans-serif",
        color: "#253A34",
        lineHeight: 1.6,
      }}
    >
      <h1 id="server-error-title">This page couldn’t load</h1>
      <p>
        We couldn’t load this page right now. Try again in a moment, or return
        home. If you were saving a change, check your saved trip before
        submitting it again.
      </p>
      <nav aria-label="Page recovery" style={{ display: "flex", gap: "24px" }}>
        {/* An empty URL reloads this exact document, including its query string. */}
        <a href="" style={{ padding: "12px 0", color: "inherit" }}>
          Try again
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Recovery must work without the app router or JavaScript. */}
        <a href="/" style={{ padding: "12px 0", color: "inherit" }}>
          Go home
        </a>
      </nav>
    </main>
  );
}
