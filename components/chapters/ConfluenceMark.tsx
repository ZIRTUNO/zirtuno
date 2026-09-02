import { confluencePath } from "@/lib/webgl/confluence-outline.mjs";

/**
 * THE CONFLUENCE, drawn without a GPU — S3's static / reduced-motion / no-WebGL
 * fallback.
 *
 * The chapter used to fall back to LogoMark, which is the Zirtuno mark: exactly
 * the thing the live liquid no longer resolves into. A fallback showing a
 * different symbol from the one the page is about is not a fallback, it is a
 * second design.
 *
 * So this is the SAME symbol, and not an approximation of it: the silhouette is
 * marched out of the confluence's own field (confluence-outline.mjs) at the
 * same iso the shader cuts, so the static tier and the live one are the same
 * shape to within a fifth of a pixel. Drawing 48 circles under an SVG goo
 * filter — the usual document-side fake — was built first and rejected: a
 * metaball chain lights a band nearly three times wider than the discs that
 * make it, so the arms came out at a third of their weight.
 *
 * Server-rendered, no client JavaScript, no runtime cost per request: the trace
 * is pure math and memoised per process.
 */
export function ConfluenceMark({
  className,
  ariaLabel,
}: {
  className?: string;
  ariaLabel?: string;
}) {
  const a11y = ariaLabel
    ? { role: "img" as const, "aria-label": ariaLabel }
    : { "aria-hidden": true as const };

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...a11y}
    >
      <defs>
        {/* The live material's own body gradient (sdf-glass-shader: deep
            #00B6CC to lite #4DECFF), lit from the same upper-left key. */}
        <linearGradient id="confluence-body" x1="0.1" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#4DECFF" />
          <stop offset="1" stopColor="#00B6CC" />
        </linearGradient>
      </defs>
      <path d={confluencePath()} fill="url(#confluence-body)" />
    </svg>
  );
}
