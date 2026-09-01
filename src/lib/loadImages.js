/**
 * Détection automatique des images de corpus, même logique que
 * loadCorpusTexts.js : import.meta.glob scanne corpus/images au build.
 *
 * Pas de `query: "?raw"` ici : pour une image, on veut l'URL finale gérée
 * par Vite (asset copié + hashé en prod), pas le contenu brut du fichier.
 * `import: "default"` renvoie directement cette URL (string).
 */
const imageModules = import.meta.glob(
  "../../corpus/images/*.{jpg,jpeg,png,gif,svg,webp}",
  {
    eager: true,
    import: "default",
  }
);

let cache = null;

function loadImages() {
  if (cache) return cache;
  cache = {};

  for (const [filePath, url] of Object.entries(imageModules)) {
    const id = filePath.split("/").pop().replace(/\.[^.]+$/, "");
    cache[id] = url;
  }

  return cache;
}

/**
 * @param {string} id - nom de fichier sans extension, ex: "platon-mondes"
 * @returns {string|undefined} URL de l'image (gérée par Vite)
 */
export function getImageUrl(id) {
  const url = loadImages()[id];
  if (!url) {
    console.warn(`⚠️  Image introuvable : corpus/images/${id}.*`);
  }
  return url;
}
