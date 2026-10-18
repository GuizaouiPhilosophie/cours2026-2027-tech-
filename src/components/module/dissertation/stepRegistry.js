/**
 * Registre des étapes du parcours de rédaction (module dissertation).
 *
 * Chaque étape est un DOSSIER dans ./steps/, détecté automatiquement au build par
 * import.meta.glob : ajouter, retirer ou renommer un dossier suffit.
 *
 * AUTONOMIE — une étape n'importe que :
 *   - ses propres fichiers ;
 *   - ./lib (code commun à toutes les étapes) ;
 *   - les bibliothèques externes.
 * Elle n'importe jamais le code d'une autre étape. Elle communique par :
 *   - les topics : données qu'elle publie (provides) et que les autres lisent avec useTopic(nom) ;
 *   - la carte : chaque nœud publie data.kind, data.label, data.text (lus avec graph.describe(id)).
 * Si un topic n'est publié par aucune étape, useTopic renvoie undefined : l'étape doit s'en passer.
 *
 *   steps/
 *   └── 01-definition/
 *       ├── step.js          ← contrat de l'étape (export par défaut)
 *       └── tools/           ← outils propres à cette étape (optionnel)
 *
 * Contrat de step.js (export par défaut) :
 *
 *   export default {
 *     id: "definition",           // identifiant unique et stable
 *     title: "Définition",        // libellé du menu des étapes
 *     description: "...",
 *     order: 10,                  // ordre croissant (à défaut : ordre du nom de dossier)
 *
 *     initial: () => data,        // données de départ de l'étape (seule source de vérité de son contenu)
 *     validate: (data, graph) => string | null,   // message qui bloque la validation (null = OK)
 *
 *     // Ce que l'étape dessine, recalculé à partir de ses données (jamais modifié à la main) :
 *     canvas: (data, { subject, topics, view }) => ({
 *       nodes: [{ id, type, position, data: { kind, label, text, … } }],   // position = position initiale
 *       edges: [{ id, type?, source, target, data? }],                      // voir link() dans lib/canvas.js
 *       decorate: { [nodeId]: { className?, zIndex? } },                    // sur n'importe quel nœud
 *     }),
 *     provides: { [topic]: (data, { subject }) => valeur },                // données publiées
 *
 *     Provider: Component,        // bulles et consignes ; reçoit :
 *                                 //   status  : "current" (modifiable) | "done" (validée) | "locked"
 *                                 //   data, setData(valeur | (ancienne) => nouvelle)
 *                                 //   view, setView(objet) : état d'affichage passé à canvas() (ex. nœud choisi)
 *                                 //   events : à passer à useCanvasEvents (lib/workspace.js)
 *                                 // et lit { subject, topics, graph, api } avec useWorkspace().
 *     nodeTypes: { type: Component }, edgeTypes: { type: Component },
 *     SubjectText: Component,     // reçoit { text } ; remplace le rendu du sujet (le premier déclaré)
 *   };
 *
 * L'éditeur possède les positions (déplacements) et l'état de chaque étape. On peut revenir sur une
 * étape validée pour la modifier : les étapes suivantes gardent leur travail (affiché en lecture seule).
 *
 * Topics publiés aujourd'hui (contrat entre étapes) :
 *   definitions    : [{ key, word, entries: [{ id, nodeId, title, text, note, related: [{ id, word, text }] }] }]
 *                    (title : terme défini, par défaut le mot du sujet `word` d'où part le lien)
 *   reformulation  : { text, nodeId } | null
 *   contradictions : [{ id, a, b, title, text }]                (a, b : ids de nœuds ; title : "" si non personnalisé)
 *   problematique  : { text, nodeId } | null
 *   connaissances  : [{ id, nodeId, title, text, links: [idDeNœud] }]   (title : "" si non personnalisé)
 *   these          : { text, nodeId } | null
 *   plan           : [{ id, num, title, fields: [{ label, text }], knowledge: [id], nodeId }]
 *
 * Contrat d'un fichier outil (export par défaut) :
 *   { id, label, icon, description, order?, Component }   // Component reçoit { subject, onClose }
 */

const stepModules = import.meta.glob("./steps/*/step.js", { eager: true });
const toolModules = import.meta.glob("./steps/*/tools/*.{js,jsx}", { eager: true });

// "./steps/01-definition/step.js" -> "01-definition"
const folderOf = (path) => path.split("/")[2];

const toolsByFolder = {};
for (const [path, mod] of Object.entries(toolModules)) {
  const tool = mod.default;
  if (!tool || !tool.id) {
    console.warn(`[module/dissertation] outil ignoré (export par défaut invalide) : ${path}`);
    continue;
  }
  (toolsByFolder[folderOf(path)] ??= []).push(tool);
}
for (const list of Object.values(toolsByFolder)) {
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

const steps = Object.entries(stepModules)
  .map(([path, mod]) => {
    const step = mod.default;
    if (!step || !step.id || !step.title) {
      console.warn(`[module/dissertation] étape ignorée (export par défaut invalide) : ${path}`);
      return null;
    }
    const folder = folderOf(path);
    return { ...step, folder, tools: toolsByFolder[folder] ?? [] };
  })
  .filter(Boolean)
  .sort(
    (a, b) =>
      (a.order ?? 0) - (b.order ?? 0) || a.folder.localeCompare(b.folder, "fr", { numeric: true })
  );

const ids = new Set();
for (const s of steps) {
  if (ids.has(s.id)) console.warn(`[module/dissertation] id d'étape en double : « ${s.id} »`);
  ids.add(s.id);
}

export default steps;
