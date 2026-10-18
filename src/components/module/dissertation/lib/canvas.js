import { Position } from "@xyflow/react";

/**
 * Constantes et utilitaires du canevas, communs à toutes les étapes.
 */

/** Id du nœud du sujet (créé par l'éditeur). */
export const SUBJECT_ID = "subject";

// Superposition : les nœuds des étapes passent au-dessus du sujet, les liens entre les deux.
// React Flow ajoute +1000 au nœud sélectionné : NODE_Z doit dépasser cela.
export const NODE_Z = 2000;
export const EDGE_Z = 1500;
/** Nœud remonté au-dessus des liens mais sous les autres nœuds (ex. sujet avec un menu ouvert). */
export const RAISED_Z = 1800;

/** En dessous de cette largeur d'écran (px), les bulles passent en plein écran. */
export const NARROW = 640;

let uid = 0;
/** Identifiant unique, avec un préfixe facultatif. */
export const newId = (prefix = "") => `${prefix}${Date.now().toString(36)}${(uid++).toString(36)}`;

export const SIDES = ["top", "right", "bottom", "left"];
export const OPPOSITE = { top: "bottom", right: "left", bottom: "top", left: "right" };
export const POSITION = { top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left };

/** Taille d'un nœud (mesurée par React Flow, sinon valeur par défaut). */
export const sizeOf = (node, fallback = { width: 260, height: 120 }) => ({
  width: node?.measured?.width ?? fallback.width,
  height: node?.measured?.height ?? fallback.height,
});

export const centerOf = (node) => {
  const s = sizeOf(node);
  return { x: node.position.x + s.width / 2, y: node.position.y + s.height / 2 };
};

/** Ordonnée du bas du nœud le plus bas (pour placer un nouveau nœud sous toute la carte). */
export const lowestBottom = (nodes) =>
  nodes.reduce((m, n) => Math.max(m, n.position.y + sizeOf(n).height), -Infinity);

/**
 * Lien standard (type « floating », dessiné par lib/FloatingEdge.jsx).
 *   tone      : "default" | "contradiction" | "knowledge" (couleur, voir ui.css)
 *   variant   : "bezier" (courbe) | "straight"
 *   clickable : un clic sur le lien est transmis aux étapes (onEdgeClick)
 */
export function link(id, source, target, { tone = "default", variant = "bezier", clickable = false, data } = {}) {
  return { id, type: "floating", source, target, data: { tone, variant, clickable, ...data } };
}
