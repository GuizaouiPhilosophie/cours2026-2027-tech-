import { parseBibtex, formatAuthors, extractYear } from "./bib";

/**
 * ?raw : on veut le contenu texte brut, pas un traitement Vite du fichier
 * (ni du bundling JS pour le .html, ni un import asset pour le .bib).
 */
const bibModules = import.meta.glob("../../corpus/zotero/*.bib", {
  eager: true,
  query: "?raw",
  import: "default",
});

const textModules = import.meta.glob("../../corpus/textes/*.html", {
  eager: true,
  query: "?raw",
  import: "default",
});

let bibEntriesCache = null;
function loadBibEntries() {
  if (bibEntriesCache) return bibEntriesCache;
  bibEntriesCache = {};
  for (const raw of Object.values(bibModules)) {
    Object.assign(bibEntriesCache, parseBibtex(raw));
  }
  return bibEntriesCache;
}

/**
 * Accès à un enregistrement .bib brut par sa clé Zotero (ex: "platon1993").
 * Utilisé pour construire la bibliographie d'une séance à partir des ids
 * de corpus référencés (voir SeanceMarkdown.jsx), là où `getCorpusText`
 * renvoie des métadonnées déjà simplifiées (auteur/oeuvre/date seulement).
 */
export function getBibEntry(zoteroKey) {
  if (!zoteroKey) return null;
  return loadBibEntries()[zoteroKey] || null;
}

const META_RE = /<script[^>]*data-corpus-meta[^>]*>([\s\S]*?)<\/script>/i;

function splitMetaAndBody(raw) {
  const match = raw.match(META_RE);
  if (!match) return { localMeta: {}, body: raw.trim() };

  let localMeta = {};
  try {
    localMeta = JSON.parse(match[1]);
  } catch (e) {
    console.warn("Bloc data-corpus-meta invalide :", e);
  }

  const body = raw.slice(0, match.index) + raw.slice(match.index + match[0].length);
  return { localMeta, body: body.trim() };
}

/**
 * Fusionne les métadonnées Zotero avec les éventuels champs locaux du
 * fichier html. Seul `zotero` (la clé) et `pages` (localisation propre à
 * l'extrait, absente du .bib) sont attendus côté html : tout le reste
 * (auteur, œuvre, date...) vient du .bib. Un champ local du même nom
 * qu'un champ du .bib prime toujours dessus, au cas où.
 */
function buildMeta(localMeta) {
  const { zotero, ...overrides } = localMeta;
  const entry = zotero ? getBibEntry(zotero) : null;

  if (zotero && !entry) {
    console.warn(`⚠️  Clé Zotero "${zotero}" introuvable dans le .bib`);
  }

  return {
    auteur: entry ? formatAuthors(entry.author) : undefined,
    oeuvre: entry?.title,
    date: entry ? extractYear(entry.date) : undefined,
    ...overrides,
  };
}

let cache = null;

export function loadCorpusTexts() {
  if (cache) return cache;
  cache = {};

  for (const [filePath, raw] of Object.entries(textModules)) {
    const id = filePath.split("/").pop().replace(/\.html$/, "");
    const { localMeta, body } = splitMetaAndBody(raw);
    cache[id] = {
      id,
      meta: buildMeta(localMeta),
      html: body,
      // Clé Zotero brute conservée à part (pas dans `meta`, pour ne pas
      // polluer l'affichage de CorpusText) : elle sert à retrouver la
      // fiche bibliographique complète dans SeanceMarkdown.jsx.
      zotero: localMeta.zotero,
    };
  }

  return cache;
}

export function getCorpusText(id) {
  const text = loadCorpusTexts()[id];
  if (!text) {
    console.warn(`⚠️  Texte de corpus introuvable : corpus/textes/${id}.html`);
  }
  return text;
}