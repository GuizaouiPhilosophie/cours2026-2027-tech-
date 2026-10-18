/**
 * Accès à corpus/definitions.json : index, recherche, découpage du sujet en mots.
 * Chemin relatif depuis ce fichier (src/components/module/dissertation/steps/01-definition/lib/)
 * jusqu'à la racine du projet. Plus robuste : un alias Vite (ex. « @corpus ») dans vite.config.js.
 */
import raw from "../../../../../../../corpus/definitions.json";

const terms = raw.termes;

export const byId = new Map(terms.map((t) => [t.id, t]));

/** Termes triés par ordre alphabétique (français). */
export const glossary = [...terms].sort((a, b) =>
  a.terme.localeCompare(b.terme, "fr", { sensitivity: "base" })
);

/** minuscules, sans accents, apostrophes -> espaces */
export const normalize = (s) =>
  s
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’']/g, " ")
    .trim();

// Tolère le pluriel : « principes » trouve « Principe ».
const stem = (w) => (w.length > 3 ? w.replace(/[sx]$/, "") : w);

const index = terms.map((t) => ({
  term: t,
  name: stem(normalize(t.terme)),
  repere: normalize(t.repere ?? ""),
  def: normalize(t.definition ?? ""),
}));

/**
 * Recherche classée : nom exact > début du nom > début d'un mot du nom >
 * contenu dans le nom > repère > texte de la définition.
 * Sous 3 caractères : correspondance exacte uniquement (évite « le », « un »…).
 */
export function searchTerms(query, limit = 8) {
  const q = stem(normalize(query));
  if (!q) return [];
  const scored = [];
  for (const { term, name, repere, def } of index) {
    let score = 0;
    if (name === q) score = 100;
    else if (q.length >= 3) {
      if (name.startsWith(q)) score = 80;
      else if (name.split(/\s+/).some((w) => w.startsWith(q))) score = 70;
      else if (name.includes(q)) score = 60;
      else if (q.length >= 4 && repere.includes(q)) score = 40;
      else if (q.length >= 4 && def.includes(q)) score = 20;
    }
    if (score) scored.push([score, term]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].terme.localeCompare(b[1].terme, "fr"));
  return scored.slice(0, limit).map(([, t]) => t);
}

/** Glossaire alphabétique, filtré par la recherche (tout le glossaire si vide). */
export function filterGlossary(query) {
  if (!normalize(query)) return glossary;
  const keep = new Set(searchTerms(query, Infinity).map((t) => t.id));
  return glossary.filter((t) => keep.has(t.id));
}

/* ---------- Découpage du sujet ---------- */

const WORD = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu;

export const wordKey = (w) => w.toLocaleLowerCase("fr");

/**
 * "Peut-on être heureux ?" -> [{type:"word", text, key}, {type:"sep", text}, ...]
 * Les mots d'une seule lettre (l’, d’, à…) restent du texte simple.
 */
export function tokenize(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(WORD)) {
    if (m.index > last) out.push({ type: "sep", text: text.slice(last, m.index) });
    out.push(
      m[0].length >= 2
        ? { type: "word", text: m[0], key: wordKey(m[0]) }
        : { type: "sep", text: m[0] }
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "sep", text: text.slice(last) });
  return out;
}