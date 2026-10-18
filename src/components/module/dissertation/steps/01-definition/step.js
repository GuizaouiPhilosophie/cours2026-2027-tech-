import Provider from "./DefinitionProvider";
import SubjectText from "./SubjectText";
import DefinitionNode from "./components/DefinitionNode";
import DefinitionEdge from "./components/DefinitionEdge";
import { byId, tokenize } from "./lib/definitions";
import { defNodeId } from "./lib/placement";
import { SUBJECT_ID, RAISED_Z, link } from "../../lib/canvas";

const MIN_DEFINITIONS = 2;

/** Nœuds de concepts associés descendant d'un nœud (récursivement). */
const descendants = (children, id) =>
  Object.values(children)
    .filter((c) => c.parent === id)
    .flatMap((c) => [c, ...descendants(children, c.id)]);

/** Terme défini : le titre choisi, sinon le mot du sujet. */
const titleOf = (e) => e.title?.trim() || e.word;

const countEntries = (data) => Object.values(data.entries).reduce((n, list) => n + list.length, 0);

export default {
  id: "definition",
  title: "Définition",
  description: "Cliquez sur un mot du sujet pour le définir.",
  order: 10,
  Provider,
  SubjectText,
  nodeTypes: { definition: DefinitionNode },
  edgeTypes: { "definition-word": DefinitionEdge },

  initial: () => ({ entries: {}, children: {} }),

  canvas: (data, { view }) => {
    const nodes = [];
    const edges = [];
    for (const [key, list] of Object.entries(data.entries)) {
      for (const e of list) {
        const id = defNodeId(key, e.id);
        nodes.push({
          id,
          type: "definition",
          position: e.position,
          data: {
            kind: "definition",
            label: titleOf(e),
            titled: titleOf(e) !== e.word,
            word: e.word, // mot du sujet d'où part le lien
            text: e.text,
            key,
            defId: e.id,
            source: e.source,
          },
        });
        edges.push({ id: `e:${id}`, type: "definition-word", source: SUBJECT_ID, target: id, data: { key } });
      }
    }
    for (const c of Object.values(data.children)) {
      nodes.push({
        id: c.id,
        type: "definition",
        position: c.position,
        data: { kind: "definition", label: c.word, text: c.text, source: c.source, child: true },
      });
      edges.push(link(`e:${c.id}`, c.parent, c.id));
    }
    // Menu « + définition » ouvert : le sujet passe au-dessus des liens.
    const decorate = view.menuOpen ? { [SUBJECT_ID]: { zIndex: RAISED_Z } } : {};
    return { nodes, edges, decorate };
  },

  provides: {
    // Mots définis, dans l'ordre du sujet, avec leurs définitions et les concepts associés créés.
    definitions: (data, { subject }) => {
      const seen = new Set();
      const out = [];
      for (const t of tokenize(subject)) {
        if (t.type !== "word" || seen.has(t.key) || !data.entries[t.key]?.length) continue;
        seen.add(t.key);
        out.push({
          key: t.key,
          word: t.text,
          entries: data.entries[t.key].map((e) => {
            const nodeId = defNodeId(t.key, e.id);
            const src = e.source ? byId.get(e.source) : null;
            return {
              id: e.id,
              nodeId,
              title: titleOf(e),
              text: e.text,
              note: src ? `Glossaire : ${src.terme}` : null,
              related: descendants(data.children, nodeId).map((c) => ({ id: c.id, word: c.word, text: c.text })),
            };
          }),
        });
      }
      return out;
    },
  },

  // Seules les définitions de mots comptent (pas les concepts associés).
  validate: (data) =>
    countEntries(data) >= MIN_DEFINITIONS
      ? null
      : `Rédigez au moins ${MIN_DEFINITIONS} définitions de mots du sujet pour passer à l'étape suivante.`,
};
