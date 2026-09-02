/**
 * Détection automatique des dividers, même logique que loadImages.js :
 * import.meta.glob scanne src/assets/dividers au build. Vite gère alors
 * l'URL finale (avec le bon préfixe de base), plutôt qu'un chemin en
 * dur vers public/ qui casse dès que le site est servi depuis une
 * sous-URL. Les dividers sont des éléments de décor d'interface, pas du
 * contenu de cours : ils ne vont donc pas dans corpus/.
 */
const dividerModules = import.meta.glob("../assets/dividers/*.{svg,jpg,jpeg,png}", {
  eager: true,
  import: "default",
});

let cache = null;

function loadDividers() {
  if (cache) return cache;
  cache = {};

  for (const [filePath, url] of Object.entries(dividerModules)) {
    const id = filePath.split("/").pop().replace(/\.[^.]+$/, "");
    cache[id] = url;
  }

  return cache;
}

/**
 * @param {string} id - nom de fichier sans extension, ex: "divider1"
 * @returns {string|undefined} URL du divider (gérée par Vite)
 */
export function getDividerUrl(id) {
  const url = loadDividers()[id];
  if (!url) {
    console.warn(`⚠️  Divider introuvable : corpus/dividers/${id}.*`);
  }
  return url;
}
