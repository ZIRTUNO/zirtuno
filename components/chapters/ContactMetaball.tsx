import { LogoMark } from "@/components/hero/LogoMark";

// re-export for any legacy import site; the constant lives with the scene now
export { EXHALE_EVENT } from "@/lib/webgl/scenes/contact";

/**
 * S10 — the contact liquid's STAGE (R5-A): a layout box + static fallback.
 * The living mark itself renders on the PAGE fluid (PageStage's contact
 * scene, anchored to `.contact-metaball-stage`): the EXACT resting mark,
 * breathing, which "exhales" on submit (the `zirtuno:exhale` window event —
 * additive only; the labeled submit is canonical). The fallback LogoMark
 * shows on the static path via the shared `.journey-static` mechanism.
 */
export function ContactMetaball() {
  return (
    <div className="contact-metaball-stage" role="img" aria-label="Zirtuno">
      <LogoMark className="journey-static contact-metaball-fallback" />
    </div>
  );
}
