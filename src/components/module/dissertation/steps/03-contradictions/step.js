import Provider from "./ContradictionProvider";
import ContradictionNode from "./components/ContradictionNode";
import { contraNodeId, hasNode } from "./ids";
import { link } from "../../lib/canvas";

const DEFAULT_TITLE = "Contradiction";

const red = (id, suffix, source, target, cid) =>
  link(`e:${id}:${suffix}`, source, target, { tone: "contradiction", variant: "straight", clickable: true, data: { cid } });

export default {
  id: "contradictions",
  title: "Identification des contradictions",
  description: "Cliquez sur deux nœuds pour les relier, puis commentez le lien.",
  order: 30,
  Provider,
  nodeTypes: { contradiction: ContradictionNode },

  // items : { [cid]: { id, a, b, title, text, position } }
  //   a, b : ids de nœuds ; title : titre personnalisé ("" = « Contradiction ») ; position du nœud d'intersection
  initial: () => ({ items: {} }),

  /**
   * Sans commentaire : un lien rouge a → b. Avec : un nœud d'intersection relié à a et à b.
   * Seul le premier nœud choisi pendant la liaison est mis en évidence (contour en pointillés).
   */
  canvas: (data, { view }) => {
    const list = Object.values(data.items);
    const nodes = [];
    const edges = [];
    for (const c of list) {
      if (hasNode(c, list)) {
        const id = contraNodeId(c.id);
        nodes.push({
          id,
          type: "contradiction",
          position: c.position ?? { x: 0, y: 0 },
          data: {
            kind: "contradiction",
            label: c.title?.trim() || DEFAULT_TITLE,
            titled: !!c.title?.trim(),
            text: c.text,
            cid: c.id,
          },
        });
        edges.push(red(c.id, "a", c.a, id, c.id), red(c.id, "b", c.b, id, c.id));
      } else {
        edges.push(red(c.id, "ab", c.a, c.b, c.id));
      }
    }
    const decorate = view.picked ? { [view.picked]: { className: "is-link-source" } } : {};
    return { nodes, edges, decorate };
  },

  provides: {
    contradictions: (data) =>
      Object.values(data.items).map(({ id, a, b, title, text }) => ({ id, a, b, title: title?.trim() ?? "", text })),
  },

  // Au moins un lien rouge entre deux éléments qui existent encore.
  validate: (data, graph) =>
    Object.values(data.items).some((c) => graph.hasNode(c.a) && graph.hasNode(c.b))
      ? null
      : "Reliez au moins deux éléments contradictoires pour passer à l'étape suivante.",
};
