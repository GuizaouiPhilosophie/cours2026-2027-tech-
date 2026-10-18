import Provider from "./ReformulationProvider";
import ReformulationNode from "./components/ReformulationNode";
import { SUBJECT_ID, link } from "../../lib/canvas";
import { NODE_ID } from "./ids";

export default {
  id: "reformulation",
  title: "Reformulation du sujet",
  description: "Cliquez sur le sujet pour le reformuler à partir de vos définitions.",
  order: 20,
  Provider,
  nodeTypes: { reformulation: ReformulationNode },

  initial: () => ({ text: "", position: null }),

  canvas: (data) =>
    data.text.trim()
      ? {
          nodes: [
            {
              id: NODE_ID,
              type: "reformulation",
              position: data.position ?? { x: 0, y: -300 },
              data: { kind: "reformulation", label: "Reformulation", text: data.text },
            },
          ],
          edges: [link(`e:${NODE_ID}`, NODE_ID, SUBJECT_ID)],
        }
      : {},

  provides: {
    reformulation: (data) => (data.text.trim() ? { text: data.text, nodeId: NODE_ID } : null),
  },

  validate: (data) => (data.text.trim() ? null : "Rédigez votre reformulation pour passer à l'étape suivante."),
};
