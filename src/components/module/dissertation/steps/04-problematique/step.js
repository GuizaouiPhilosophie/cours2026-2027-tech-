import Provider from "./ProblematiqueProvider";
import ProblematiqueNode from "./components/ProblematiqueNode";
import { NODE_ID } from "./ids";
import { SUBJECT_ID, link } from "../../lib/canvas";

export default {
  id: "problematique",
  title: "Problématique",
  description: "Cliquez sur le sujet pour formuler la problématique à partir de vos définitions et contradictions.",
  order: 40,
  Provider,
  nodeTypes: { problematique: ProblematiqueNode },

  initial: () => ({ text: "", position: null }),

  canvas: (data) =>
    data.text.trim()
      ? {
          nodes: [
            {
              id: NODE_ID,
              type: "problematique",
              position: data.position ?? { x: 0, y: 300 },
              data: { kind: "problematique", label: "Problématique", text: data.text },
            },
          ],
          edges: [link(`e:${NODE_ID}`, NODE_ID, SUBJECT_ID)],
        }
      : {},

  provides: {
    problematique: (data) => (data.text.trim() ? { text: data.text, nodeId: NODE_ID } : null),
  },

  // Un texte non vide, formulé comme une question.
  validate: (data) => {
    const text = data.text.trim();
    if (!text) return "Rédigez votre problématique pour passer à l'étape suivante.";
    if (!text.includes("?")) return "Votre problématique doit prendre la forme d'une question.";
    return null;
  },
};
