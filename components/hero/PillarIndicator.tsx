import { cn } from "@/lib/utils";

/**
 * Pillar indicator (S2.3) — a fast visual index of the seven services. In
 * Phase 2 it tracks the metaball's active state as the hero auto-cycles.
 */
export function PillarIndicator({ active = 0 }: { active?: number }) {
  return (
    <div className="pillar-indicator" aria-hidden="true">
      {Array.from({ length: 7 }).map((_, i) => (
        <span
          key={i}
          className={cn("pillar-dot", i === active && "is-active")}
        />
      ))}
    </div>
  );
}
