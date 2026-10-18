import Provider from "./TheseProvider";
import TheseNode from "./components/TheseNode";
import { NODE_ID } from "./ids";
import { SUBJECT_ID, link } from "../../lib/canvas";

export default {
  id: "these",
  title: "Thèse",
  description: "Cliquez sur la problématique pour proposer votre réponse.",
  order: 60,
  Provider,
  nodeTypes: { these: TheseNode },

  initial: () => ({ text: "", position: null }),

  // Reliée à la problématique (topic), ou au sujet si aucune étape ne la publie.
  canvas: (data, { topics }) =>
    data.text.trim()
      ? {
          nodes: [
            {
              id: NODE_ID,
              type: "these",
              position: data.position ?? { x: 0, y: 600 },
              data: { kind: "these", label: "Thèse", text: data.text },
            },
          ],
          edges: [link(`e:${NODE_ID}`, NODE_ID, topics.problematique?.nodeId ?? SUBJECT_ID)],
        }
      : {},

  provides: {
    these: (data) => (data.text.trim() ? { text: data.text, nodeId: NODE_ID } : null),
  },

  validate: (data) => (data.text.trim() ? null : "Rédigez votre thèse pour passer à l'étape suivante."),
};
