import { createContext, useContext, useEffect, useLayoutEffect, useRef } from "react";

/**
 * Contrat entre l'éditeur et les étapes. Une étape n'importe JAMAIS le code d'une autre :
 * elle lit ce que les autres publient (topics) et ce qui est sur la carte (graph).
 *
 *   subject : texte du sujet
 *   topics  : { [nom]: valeur } publiées par les étapes (step.provides), voir stepRegistry.js
 *   graph   : lecture de la carte, sans effet de bord (utilisable pendant le rendu)
 *     hasNode(id)  → booléen
 *     getNode(id)  → nœud (contenu, sans position à jour) ou null
 *     describe(id) → { label, text, kind, titled, missing? }
 *                    (tout nœud publie data.label / data.text / data.kind ; data.titled = titre personnalisé)
 *   api     : actions impératives (à n'utiliser que dans des gestionnaires d'événements)
 *     getNode(id) / getNodes()       → nœuds actuels, avec position et taille mesurée
 *     screenToFlowPosition({ x, y }) → coordonnées du canevas
 *     nodeAnchor(id)                 → ancre de bulle d'un nœud affiché, ou null
 *     viewportCenter()               → { anchor, position } du centre de l'écran
 */
const emptyGraph = {
  hasNode: () => false,
  getNode: () => null,
  describe: () => ({ label: "Élément supprimé", text: "", kind: null, missing: true }),
};

export const WorkspaceContext = createContext({ subject: "", topics: {}, graph: emptyGraph, api: null });

export const useWorkspace = () => useContext(WorkspaceContext);

/** Valeur publiée par une autre étape sous ce nom (undefined si aucune étape ne la publie). */
export const useTopic = (name) => useContext(WorkspaceContext).topics[name];

/**
 * Abonne une étape aux événements du canevas. `events` est la prop reçue par le Provider de l'étape.
 * Chaque gestionnaire renvoie true s'il a traité l'événement :
 *   onNodeClick({ node, anchor })          clic (ou Entrée / Espace) sur un nœud
 *   onEdgeClick({ edge, anchor })          clic sur un lien « clickable »
 *   onPaneClick()                          clic dans le vide
 *   onPaneDoubleClick({ anchor, position }) double clic / double toucher dans le vide
 * Ordre d'appel : l'étape en cours d'abord ; si elle ne traite pas un clic sur un nœud ou un lien,
 * l'étape qui l'a créé (son « propriétaire ») le reçoit, par exemple pour l'ouvrir en lecture seule.
 * Les boutons, liens, champs et zones .nodrag à l'intérieur d'un nœud gèrent eux-mêmes leurs clics.
 */
export function useCanvasEvents(events, handlers) {
  const ref = useRef(handlers);
  useLayoutEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => events.bind(ref), [events]);
}
