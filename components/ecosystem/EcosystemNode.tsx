/**
 * A single orbiting node in the ecosystem diagram (S4.4). Keyboard-focusable
 * with an accessible label; the tooltip reveals the node's role on hover/focus.
 * Reports hover/focus up so the diagram can light this node's connector line.
 */
export function EcosystemNode({
  name,
  tooltip,
  x,
  y,
  onActivate,
  onDeactivate,
}: {
  name: string;
  tooltip: string;
  x: number;
  y: number;
  onActivate?: () => void;
  onDeactivate?: () => void;
}) {
  return (
    <div
      className="eco-node"
      style={{ left: `${x}%`, top: `${y}%` }}
      data-cursor="hover"
      tabIndex={0}
      aria-label={`${name}: ${tooltip}`}
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
    >
      <span className="eco-node-dot" aria-hidden="true" />
      <span className="eco-node-name">{name}</span>
      <span className="eco-node-tip" role="tooltip">
        {tooltip}
      </span>
    </div>
  );
}
