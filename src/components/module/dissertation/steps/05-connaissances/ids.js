/** Id du nœud d'une connaissance. */
export const knowNodeId = (kid) => `know-${kid}`;
/** Id de la connaissance d'un nœud de connaissance, ou null. */
export const kidOf = (nodeId) => (nodeId.startsWith("know-") ? nodeId.slice(5) : null);
