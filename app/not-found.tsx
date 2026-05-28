// Root fallback 404 for unmatched non-locale paths. The root layout is a
// passthrough, so this provides its own <html>/<body>. Locale-aware 404s live
// in app/[locale]/not-found.tsx.
export default function RootNotFound() {
  return (
    <html lang="pt">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "grid",
          placeItems: "center",
          background: "#000",
          color: "#F2F0EB",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <div>
          <p style={{ color: "#00D4FF", letterSpacing: "0.1em", margin: 0 }}>
            404
          </p>
          <h1 style={{ fontWeight: 500, margin: "0.5rem 0 1.5rem" }}>
            Zirtuno
          </h1>
          <a href="/pt" style={{ color: "#00D4FF" }}>
            → início
          </a>
        </div>
      </body>
    </html>
  );
}
