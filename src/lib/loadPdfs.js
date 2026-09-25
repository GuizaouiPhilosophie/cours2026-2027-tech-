/**
 * Détection automatique des PDF de corpus, même logique que
 * loadImages.js : import.meta.glob scanne corpus/pdf au build.
 *
 * Pas de `query: "?raw"` ici : on veut l'URL finale gérée par Vite
 * (asset copié + hashé en prod), pas le contenu brut du fichier.
 */
const pdfModules = import.meta.glob("../../corpus/pdf/*.pdf", {
  eager: true,
  import: "default",
});

let cache = null;

function loadPdfs() {
  if (cache) return cache;
  cache = {};

  for (const [filePath, url] of Object.entries(pdfModules)) {
    const id = filePath.split("/").pop().replace(/\.pdf$/, "");
    cache[id] = url;
  }

  return cache;
}

/**
 * @param {string} id - nom de fichier sans extension, ex: "2026bactech"
 * @returns {string|undefined} URL du PDF (gérée par Vite)
 */
export function getPdfUrl(id) {
  const url = loadPdfs()[id];
  if (!url) {
    console.warn(`⚠️  PDF introuvable : corpus/pdf/${id}.pdf`);
  }
  return url;
}