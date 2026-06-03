"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { EcosystemCore } from "./EcosystemCore";
import { EcosystemNode } from "./EcosystemNode";

type Node = { name: string; tooltip: string };

/**
 * S4.4 · Ecosystem Diagram. Center = the client's business (the unified metaball
 * core, scroll-converged from the S3 shards) with the SEU NEGÓCIO label. Ten
 * nodes orbit, each joined to the core by a line that carries a traveling
 * data-flow pulse (the ecosystem is alive). Hovering a node brightens the node,
 * its connector, and reveals its role. A faint orbit ring rotates slowly behind.
 * Desktop renders the radial diagram; mobile a vertical connected stack.
 */
export function EcosystemDiagram() {
  const t = useTranslations("ecosystem");
  const nodes = t.raw("nodes") as Node[];
  const [hovered, setHovered] = useState<number | null>(null);
  const radius = 40; // % of the square stage

  const positioned = nodes.map((n, i) => {
    const angle = ((-90 + i * (360 / nodes.length)) * Math.PI) / 180;
    return {
      ...n,
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
    };
  });

  return (
    <div className="eco">
      {/* Desktop — radial diagram */}
      <div
        className="eco-radial hidden md:block"
        role="group"
        aria-label={t("headline")}
      >
        <svg
          className="eco-lines"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* slow-rotating orbit ring — a quiet sign of life behind the core */}
          <circle className="eco-orbit" cx="50" cy="50" r={radius} />

          {/* static connectors (brighten on hover of their node) */}
          {positioned.map((p, i) => (
            <line
              key={`line-${i}`}
              x1="50"
              y1="50"
              x2={p.x}
              y2={p.y}
              className={cn("eco-line", hovered === i && "is-lit")}
            />
          ))}

          {/* traveling data-flow pulses (node → core), staggered so they breathe */}
          {positioned.map((p, i) => (
            <line
              key={`pulse-${i}`}
              x1={p.x}
              y1={p.y}
              x2="50"
              y2="50"
              className={cn("eco-pulse", hovered === i && "is-lit")}
              style={{ animationDelay: `${(i * 0.43).toFixed(2)}s` }}
            />
          ))}
        </svg>

        <div className="eco-core">
          <EcosystemCore ariaLabel={t("centerLabel")} />
          <span className="eco-core-label">{t("centerLabel")}</span>
        </div>

        {positioned.map((p, i) => (
          <EcosystemNode
            key={i}
            name={p.name}
            tooltip={p.tooltip}
            x={p.x}
            y={p.y}
            onActivate={() => setHovered(i)}
            onDeactivate={() => setHovered((h) => (h === i ? null : h))}
          />
        ))}
      </div>

      {/* Mobile — vertical connected stack; tooltips become captions */}
      <ul className="eco-stack md:hidden" aria-label={t("headline")}>
        <li className="eco-stack-center">{t("centerLabel")}</li>
        {nodes.map((n, i) => (
          <li key={i} className="eco-stack-item">
            <span className="eco-stack-name">{n.name}</span>
            <span className="eco-stack-cap">{n.tooltip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
