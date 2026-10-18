import { BaseEdge, getBezierPath, useInternalNode } from "@xyflow/react";
import { facingSide, wordHandleBounds } from "../lib/placement";
import { OPPOSITE, POSITION } from "../../../lib/canvas";
import FloatingEdge from "../../../lib/FloatingEdge";

/** Milieu du côté `side` d'un nœud interne (coordonnées du canevas). */
function sideCenter(node, side) {
  const p = node.internals.positionAbsolute;
  const w = node.measured.width;
  const h = node.measured.height;
  return {
    top: { x: p.x + w / 2, y: p.y },
    bottom: { x: p.x + w / 2, y: p.y + h },
    left: { x: p.x, y: p.y + h / 2 },
    right: { x: p.x + w, y: p.y + h / 2 },
  }[side];
}

/**
 * Lien d'un mot du sujet vers une de ses définitions : il part du côté du MOT tourné vers le nœud
 * (poignées déclarées par SubjectText) et arrive sur le côté opposé du nœud. Recalculé à chaque
 * déplacement. Si les poignées des mots n'existent pas, lien flottant ordinaire.
 */
export default function DefinitionEdge(props) {
  const { id, source, target, data } = props;
  const subject = useInternalNode(source);
  const node = useInternalNode(target);
  const side = facingSide(node, subject, data.key);
  const h = side ? wordHandleBounds(subject, data.key, side) : null;
  if (!h) return <FloatingEdge {...props} />;

  const o = subject.internals.positionAbsolute;
  const opposite = OPPOSITE[side];
  const end = sideCenter(node, opposite);
  const [path] = getBezierPath({
    sourceX: o.x + h.x + h.width / 2,
    sourceY: o.y + h.y + h.height / 2,
    sourcePosition: POSITION[side],
    targetX: end.x,
    targetY: end.y,
    targetPosition: POSITION[opposite],
  });

  return (
    <g className="dissertation-edge is-default">
      <BaseEdge id={id} path={path} interactionWidth={0} />
    </g>
  );
}
