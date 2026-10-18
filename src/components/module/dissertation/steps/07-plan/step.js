import Provider from "./PlanProvider";
import PlanNode from "./components/PlanNode";
import { PARTS, planNodeId, emptyPart, isStarted } from "./lib/parts";
import { SUBJECT_ID, link } from "../../lib/canvas";

export default {
  id: "plan",
  title: "Plan dialectique",
  description: "Cliquez sur la thèse pour construire les trois parties du plan.",
  order: 70,
  Provider,
  nodeTypes: { plan: PlanNode },

  // parts : { [idPartie]: { idea, limit, answer, knowledge: [idConnaissance], position } }
  initial: () => ({ parts: Object.fromEntries(PARTS.map((p) => [p.id, emptyPart()])) }),

  // Une partie apparaît dès qu'un champ est rempli, reliée à la thèse (ou au sujet sans thèse publiée).
  canvas: (data, { topics }) => {
    const parent = topics.these?.nodeId ?? SUBJECT_ID;
    const started = PARTS.filter((p) => isStarted(p, data.parts[p.id]));
    return {
      nodes: started.map((p) => ({
        id: planNodeId(p.id),
        type: "plan",
        position: data.parts[p.id].position ?? { x: 0, y: 900 },
        data: { kind: "plan", label: `${p.num}. ${p.title}`, text: data.parts[p.id].idea, part: p.id, ...data.parts[p.id] },
      })),
      edges: started.map((p) => link(`e:${planNodeId(p.id)}`, planNodeId(p.id), parent)),
    };
  },

  provides: {
    plan: (data) =>
      PARTS.map((p) => ({
        id: p.id,
        num: p.num,
        title: p.title,
        nodeId: isStarted(p, data.parts[p.id]) ? planNodeId(p.id) : null,
        fields: p.fields.map((f) => ({ label: f.label, text: data.parts[p.id][f.key] })),
        knowledge: data.parts[p.id].knowledge,
      })),
  },

  // Les deux champs de chaque partie doivent être remplis.
  validate: (data) => {
    for (const part of PARTS) {
      for (const f of part.fields) {
        if (!data.parts[part.id][f.key]?.trim()) return `Partie ${part.num} (${part.title}) : complétez « ${f.label} ».`;
      }
    }
    return null;
  },
};
