import Provider from "./KnowledgeProvider";
import KnowledgeNode from "./components/KnowledgeNode";
import { knowNodeId, kidOf } from "./ids";
import { link } from "../../lib/canvas";

/** Ids des nœuds reliés à `nodeId`. */
const linkedTo = (links, nodeId) =>
  Object.values(links)
    .filter((l) => l.a === nodeId || l.b === nodeId)
    .map((l) => (l.a === nodeId ? l.b : l.a));

export default {
  id: "connaissances",
  title: "Connaissances",
  description: "Double-cliquez dans le vide pour noter ce que vous savez, puis reliez-le aux autres nœuds.",
  order: 50,
  Provider,
  nodeTypes: { connaissance: KnowledgeNode },

  // items : { [kid]: { id, title, text, position } } (title : "" = « Connaissance »)
  // links : { [lid]: { id, a, b } } (a : nœud de connaissance)
  initial: () => ({ items: {}, links: {} }),

  canvas: (data, { view }) => {
    const nodes = Object.values(data.items).map((k) => {
      const id = knowNodeId(k.id);
      return {
        id,
        type: "connaissance",
        position: k.position,
        data: {
          kind: "connaissance",
          label: k.title?.trim() || "Connaissance",
          titled: !!k.title?.trim(),
          text: k.text,
          kid: k.id,
          linkCount: linkedTo(data.links, id).length,
        },
      };
    });
    const edges = Object.values(data.links).map((l) =>
      link(`e:${l.id}`, l.a, l.b, { tone: "knowledge", variant: "straight", clickable: true, data: { kid: kidOf(l.a) } })
    );
    const decorate = view.picking ? { [knowNodeId(view.picking)]: { className: "is-know-source" } } : {};
    return { nodes, edges, decorate };
  },

  provides: {
    connaissances: (data) =>
      Object.values(data.items)
        .filter((k) => k.text.trim())
        .map((k) => ({
          id: k.id,
          nodeId: knowNodeId(k.id),
          title: k.title?.trim() ?? "",
          text: k.text,
          links: linkedTo(data.links, knowNodeId(k.id)),
        })),
  },

  // Au moins une connaissance rédigée (les liens sont facultatifs).
  validate: (data) =>
    Object.values(data.items).some((k) => k.text.trim())
      ? null
      : "Ajoutez au moins une connaissance pour passer à l'étape suivante.",
};
