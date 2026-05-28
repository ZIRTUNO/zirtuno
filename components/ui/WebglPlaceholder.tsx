import { cn } from "@/lib/utils";

export type WebglVariant = "unified" | "fractured" | "particles";

/**
 * PLACEHOLDER for the four signature WebGL moments (built in Phase 2):
 *   - unified   → hero / services / contact resting metaball (S2.3)
 *   - fractured → The Problem disconnected state (S3.2)
 *   - particles → The Name etymology reveal (S8)
 * Pure CSS, fully static → inherently reduced-motion safe. The visible tag
 * marks it as not-yet-final so screenshots read unambiguously.
 */
export function WebglPlaceholder({
  variant = "unified",
  label,
  className,
  ariaLabel = "Zirtuno",
}: {
  variant?: WebglVariant;
  label?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className={cn("webgl-ph", `webgl-ph-${variant}`, className)}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="webgl-ph-stage" aria-hidden="true">
        {variant === "particles" ? (
          <div className="webgl-ph-particles">
            {Array.from({ length: 56 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
        ) : (
          <>
            <span className="blob blob-1" />
            <span className="blob blob-2" />
            <span className="blob blob-3" />
          </>
        )}
      </div>
      {label && <span className="webgl-ph-tag">{label}</span>}
    </div>
  );
}
