import { BaseEdge, Position, getBezierPath, getStraightPath, useInternalNode } from "@xyflow/react";
import "./ui.css";

/** Point où la droite entre les centres de `node` et de `other` coupe le bord de `node`. */
export function borderPoint(node, other) {
  const w = node.measured.width;
  const h = node.measured.height;
  const p = node.internals.positionAbsolute;
  const q = other.internals.positionAbsolute;
  const cx = p.x + w / 2;
  const cy = p.y + h / 2;
  const dx = q.x + other.measured.width / 2 - cx;
  const dy = q.y + other.measured.height / 2 - cy;
  const k = Math.max(Math.abs(dx) / (w / 2), Math.abs(dy) / (h / 2));
  return k ? { x: cx + dx / k, y: cy + dy / k } : { x: cx, y: cy };
}

/** Côté de `node` sur lequel se trouve `point` (pour orienter la courbe). */
function sideOf(node, point) {
  const p = node.internals.positionAbsolute;
  const dx = (point.x - (p.x + node.measured.width / 2)) / node.measured.width;
  const dy = (point.y - (p.y + node.measured.height / 2)) / node.measured.height;
  if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? Position.Bottom : Position.Top;
  return dx >= 0 ? Position.Right : Position.Left;
}

/**
 * Lien « flottant » : il relie les bords des deux nœuds, quel que soit l'endroit où on les déplace.
 * data : { tone, variant, clickable } (voir link() dans lib/canvas.js).
 */
export default function FloatingEdge({ id, source, target, data }) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s?.measured?.width || !t?.measured?.width) return null;

  const a = borderPoint(s, t);
  const b = borderPoint(t, s);
  const [path] =
    data?.variant === "straight"
      ? getStraightPath({ sourceX: a.x, sourceY: a.y, targetX: b.x, targetY: b.y })
      : getBezierPath({
          sourceX: a.x,
          sourceY: a.y,
          sourcePosition: sideOf(s, a),
          targetX: b.x,
          targetY: b.y,
          targetPosition: sideOf(t, b),
        });

  return (
    <g className={`dissertation-edge is-${data?.tone ?? "default"}${data?.clickable ? " is-clickable" : ""}`}>
      <BaseEdge id={id} path={path} interactionWidth={data?.clickable ? 28 : 0} />
    </g>
  );
}
