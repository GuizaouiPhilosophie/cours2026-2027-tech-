/** Id du nœud d'intersection d'une contradiction (il peut lui-même être relié). */
export const contraNodeId = (cid) => `contra-${cid}`;

/** Types de nœuds (data.kind) qu'on peut relier par une contradiction. */
export const LINKABLE = new Set(["definition", "reformulation", "contradiction"]);

/** Le nœud d'intersection existe s'il y a un commentaire, ou si une autre contradiction s'y rattache. */
export const hasNode = (c, list) =>
  c.text.trim() !== "" || list.some((o) => o.a === contraNodeId(c.id) || o.b === contraNodeId(c.id));
