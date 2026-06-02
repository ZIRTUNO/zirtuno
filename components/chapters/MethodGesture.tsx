import type { ReactNode } from "react";

/**
 * S6.3 — a distinct metaball gesture per phase (CSS/SVG, brand-cyan line art):
 * 01 scanning · 02 outline grid · 03 solid fill · 04 connect nodes · 05 pulse.
 * Pure markup; animations live in globals.css and are disabled under
 * prefers-reduced-motion (the resting form stays legible).
 */
const GESTURES: ReactNode[] = [
  // 0 — Diagnóstico: scanning
  <>
    <rect className="mg-frame" x="8" y="9" width="24" height="22" rx="3" />
    <line className="mg-scan" x1="11" x2="29" y1="14" y2="14" />
  </>,
  // 1 — Estrutura: outline grid
  <>
    <rect className="mg-frame" x="8" y="8" width="24" height="24" rx="3" />
    <line className="mg-grid" x1="16" x2="16" y1="8" y2="32" />
    <line className="mg-grid" x1="24" x2="24" y1="8" y2="32" />
    <line className="mg-grid" x1="8" x2="32" y1="16" y2="16" />
    <line className="mg-grid" x1="8" x2="32" y1="24" y2="24" />
  </>,
  // 2 — Construção: solid fill
  <>
    <rect className="mg-frame" x="8" y="8" width="24" height="24" rx="3" />
    <rect className="mg-fill" x="8" y="8" width="24" height="24" rx="3" />
  </>,
  // 3 — Integração: connect nodes
  <>
    <line className="mg-link" x1="12" y1="12" x2="28" y2="20" />
    <line className="mg-link" x1="28" y1="20" x2="14" y2="29" />
    <line className="mg-link" x1="12" y1="12" x2="14" y2="29" />
    <circle className="mg-node" cx="12" cy="12" r="2.6" />
    <circle className="mg-node" cx="28" cy="20" r="2.6" />
    <circle className="mg-node" cx="14" cy="29" r="2.6" />
  </>,
  // 4 — Evolução: pulse / expand
  <>
    <circle className="mg-pulse" cx="20" cy="20" r="6" />
    <circle className="mg-pulse" cx="20" cy="20" r="6" />
    <circle className="mg-pulse" cx="20" cy="20" r="6" />
    <circle className="mg-core" cx="20" cy="20" r="3" />
  </>,
];

export function MethodGesture({ phase }: { phase: number }) {
  return (
    <div className="method-gesture" aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        {GESTURES[phase] ?? GESTURES[0]}
      </svg>
    </div>
  );
}
