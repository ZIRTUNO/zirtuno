import { useTranslations } from "next-intl";
import { EcosystemCore } from "./EcosystemCore";
import { EcosystemNode } from "./EcosystemNode";

type Node = { name: string; tooltip: string };

/**
 * S4.4 · Ecosystem Diagram. Center = the client's business (unified metaball
 * core — placeholder in Phase 1 — with the SEU NEGÓCIO label). 10 nodes orbit,
 * each joined to the center by a line. Phase 2 adds the S3→S4 converge
 * transition, traveling pulses, slow rotation, and live hover highlighting.
 * Desktop renders the radial diagram; mobile a vertical connected stack.
 */
export function EcosystemDiagram() {
  const t = useTranslations("ecosystem");
  const nodes = t.raw("nodes") as Node[];
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
          {positioned.map((p, i) => (
            <line
              key={i}
              x1="50"
              y1="50"
              x2={p.x}
              y2={p.y}
              className="eco-line"
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
