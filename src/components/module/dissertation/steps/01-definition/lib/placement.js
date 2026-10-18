import { SIDES } from "../../../lib/canvas";

/** Taille approximative d'un nœud de définition (unités du canevas), pour éviter les chevauchements. */
export const DEF_W = 220;
export const DEF_H = 200;
const GAP = 16;
const DROP = 120; // distance sous le mot
const CHILD_DROP = 60; // distance sous le nœud parent

/** Id du nœud d'une définition de mot. */
export const defNodeId = (key, defId) => `def-${key}-${defId}`;
/** Id du nœud d'un concept associé, créé depuis un nœud de définition. */
export const childNodeId = (parentId, termId) => `term-${parentId}-${termId}`;
/** Id de la poignée d'un mot du sujet pour un côté donné. */
export const wordHandle = (key, side) => `${key}__${side}`;

/** Décale `x` vers la droite tant qu'il chevauche un autre nœud de définition. */
function avoid(others, x, y) {
  for (let i = 0; i <= others.length; i++) {
    const hit = others.find(
      (o) => Math.abs(o.position.x - x) < DEF_W + GAP && Math.abs(o.position.y - y) < DEF_H
    );
    if (!hit) break;
    x = hit.position.x + DEF_W + GAP;
  }
  return x;
}

const definitionNodes = (api, except) =>
  api.getNodes().filter((n) => n.data?.kind === "definition" && n.id !== except);

/** Position d'un nouveau nœud de définition : sous le mot cliqué (`anchor`, coordonnées écran). */
export function placeBelow(api, anchor) {
  const p = api.screenToFlowPosition({ x: anchor.x, y: anchor.bottom });
  const y = p.y + DROP;
  return { x: avoid(definitionNodes(api), p.x - DEF_W / 2, y), y };
}

/** Position d'un nœud de concept associé : sous son nœud parent. */
export function placeChild(api, parentId) {
  const parent = api.getNode(parentId);
  if (!parent) return { x: 0, y: 0 };
  const y = parent.position.y + (parent.measured?.height ?? DEF_H) + CHILD_DROP;
  return { x: avoid(definitionNodes(api, parentId), parent.position.x, y), y };
}

/**
 * Côté du MOT d'où doit partir le lien, selon où se trouve le nœud de définition.
 * `self` / `subject` : nœuds internes React Flow (useInternalNode). Renvoie null tant que
 * les poignées ne sont pas mesurées.
 */
export function facingSide(self, subject, key) {
  const handles = subject?.internals.handleBounds?.source;
  const w = self?.measured?.width;
  const h = self?.measured?.height;
  if (!handles || !w || !h) return null;

  const found = SIDES.map((s) => handles.find((x) => x.id === wordHandle(key, s)));
  if (found.some((x) => !x)) return null;
  const [t, r, b, l] = found;

  // Centre du mot = milieu de ses poignées gauche/droite et haut/bas (coordonnées du canevas).
  const o = subject.internals.positionAbsolute;
  const p = {
    x: o.x + (l.x + l.width / 2 + r.x + r.width / 2) / 2,
    y: o.y + (t.y + t.height / 2 + b.y + b.height / 2) / 2,
  };

  const n = self.internals.positionAbsolute;
  const dx = Math.max(n.x - p.x, p.x - (n.x + w), 0);
  const dy = Math.max(n.y - p.y, p.y - (n.y + h), 0);

  if (!dx && !dy) return "bottom"; // le nœud recouvre le mot
  if (dy >= dx) return p.y < n.y ? "bottom" : "top";
  return p.x < n.x ? "right" : "left";
}

/** Poignée (rectangle relatif au nœud) d'un mot pour un côté, ou undefined. */
export const wordHandleBounds = (subject, key, side) =>
  subject?.internals.handleBounds?.source?.find((x) => x.id === wordHandle(key, side));
