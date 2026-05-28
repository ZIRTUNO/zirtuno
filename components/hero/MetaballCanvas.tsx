import { WebglPlaceholder } from "@/components/ui/WebglPlaceholder";

/**
 * Hero metaball (S2.3). PHASE 1: static placeholder. PHASE 2 replaces the
 * internals with the 3D raymarched metaball (7 pillar states, hover physics,
 * morphing, keyboard nav). The resting "unified ecosystem" state is shared
 * with S4 — it will be exported from lib/webgl/states.ts in Phase 2.
 */
export function MetaballCanvas() {
  return (
    <WebglPlaceholder
      variant="unified"
      label="metaball · phase 2"
      ariaLabel="Zirtuno"
    />
  );
}
