/**
 * Les trois parties du plan dialectique. Chaque partie a deux champs, tous obligatoires.
 * L'id du nœud React Flow d'une partie est `plan-<id>`.
 */
export const PARTS = [
  {
    id: "oui",
    num: "I",
    title: "Oui",
    goal: "Répondez oui au sujet, puis montrez que cette réponse ne suffit pas à résoudre la problématique.",
    fields: [
      { key: "idea", label: "Oui, parce que…", placeholder: "L'argument en faveur du oui, appuyé sur vos connaissances…" },
      { key: "limit", label: "Mais c'est insuffisant, car…", placeholder: "Ce que le oui laisse sans réponse dans la problématique…" },
    ],
  },
  {
    id: "non",
    num: "II",
    title: "Non",
    goal: "Répondez non au sujet, puis montrez que cette réponse ne suffit pas non plus.",
    fields: [
      { key: "idea", label: "Non, parce que…", placeholder: "L'argument en faveur du non, appuyé sur vos connaissances…" },
      { key: "limit", label: "Mais c'est insuffisant, car…", placeholder: "Ce que le non laisse sans réponse dans la problématique…" },
    ],
  },
  {
    id: "depassement",
    num: "III",
    title: "Dépassement",
    goal: "Montrez comment votre thèse répond mieux à la problématique et apporte une réponse au sujet.",
    fields: [
      { key: "idea", label: "Votre thèse répond mieux, car…", placeholder: "En quoi elle dépasse l'opposition du oui et du non…" },
      { key: "answer", label: "Réponse au sujet", placeholder: "Ainsi, à la question posée, on peut répondre que…" },
    ],
  },
];

export const partById = Object.fromEntries(PARTS.map((p) => [p.id, p]));
export const planNodeId = (id) => `plan-${id}`;

export const emptyPart = () => ({ idea: "", limit: "", answer: "", knowledge: [], position: null });

/** Partie dont au moins un champ est rempli (le nœud existe alors sur le canevas). */
export const isStarted = (part, values) => part.fields.some((f) => values?.[f.key]?.trim());
/** Partie dont tous les champs sont remplis. */
export const isComplete = (part, values) => part.fields.every((f) => values?.[f.key]?.trim());
