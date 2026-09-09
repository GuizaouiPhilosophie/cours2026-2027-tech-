/**
 * Registre des outils d'annotation du module d'explication.
 *
 * Chaque outil est un fichier dans ./tools/, détecté automatiquement au
 * build par import.meta.glob : il suffit d'ajouter un fichier dans ce
 * dossier pour qu'il apparaisse dans la barre d'outils, sans toucher à ce
 * registre ni à ExplicationEditor.jsx.
 *
 * Contrat attendu pour un fichier outil (export par défaut) :
 *
 *   export default {
 *     id: "mouvement",        // identifiant unique et stable (clé React, nom de balise par défaut)
 *     label: "Mouvement",     // libellé affiché dans la barre d'outils
 *     icon: "[ ]",            // texte ou emoji court affiché comme icône
 *     description: "...",     // infobulle
 *     tag: "mouvement",       // nom de la balise XML générée à l'export (peut différer de id)
 *     mode: "range",          // "range" (deux poses : début puis fin) ou "point" (une pose, ex. concept)
 *     order: 10,               // optionnel, ordre d'affichage dans la barre (croissant)
 *
 *     // ---- prise en main (drag depuis la barre vers le texte) ----
 *     // La mécanique de grab (suivre la souris, afficher un fantôme,
 *     // gérer mousemove/mouseup) est générique et vit dans ./lib/grab.js.
 *     // Chaque outil ne fournit que ce qui lui est propre :
 *     snap: snapBetweenWords, // ou snapOnWord, ou une stratégie maison — (container, x, y) => {range, kind} | null
 *     ghost(payload) { ... }, // élément DOM (ou HTML string) affiché sous la souris pendant le drag ; par défaut `icon`
 *   };
 *
 * Un outil qui pose un objet directement dans le texte (comme Mouvement,
 * via `onDrop`) réutilise typiquement `startGrab` de ./lib/grab.js pour
 * aussi permettre de redéplacer un objet déjà posé (voir tools/mouvement.jsx
 * pour un exemple complet) — c'est la même mécanique de bout en bout,
 * seule la stratégie de snap (`snap`) diffère d'un outil à l'autre.
 */

const modules = import.meta.glob("./tools/*.{js,jsx}", { eager: true });

const tools = Object.entries(modules)
  .map(([path, mod]) => {
    const tool = mod.default;
    if (!tool || !tool.id) {
      console.warn(`[module/explication] outil ignoré (export par défaut invalide) : ${path}`);
      return null;
    }
    return tool;
  })
  .filter(Boolean)
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export default tools;