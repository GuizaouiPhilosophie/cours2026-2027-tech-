/**
 * Sauvegarde du travail : format, stockage dans le navigateur, lecture d'un fichier importé.
 *
 * Format (JSON) :
 *   { app, version, savedAt, subject, data: { [étape]: données }, validated: [étape], active,
 *     layout: { [nœud]: { x, y } }, author: { firstName, lastName } }
 * `layout` ne contient que les nœuds déplacés à la main ; les autres reprennent leur position initiale.
 */

export const APP_ID = "philosite-dissertation";
export const FORMAT_VERSION = 1;
const STORAGE_KEY = "philosite.dissertation";
/** Id de la balise qui porte le JSON dans un fichier HTML exporté. */
export const DATA_ELEMENT_ID = "dissertation-data";

export const EMPTY_AUTHOR = { firstName: "", lastName: "" };

const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** Photographie du travail en cours. */
export function makeSnapshot({ subject, data, validated, active, ui, author }) {
  const layout = {};
  for (const [id, u] of Object.entries(ui)) if (u.position) layout[id] = { x: u.position.x, y: u.position.y };
  return {
    app: APP_ID,
    version: FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    subject,
    data,
    validated,
    active,
    layout,
    author: author ?? EMPTY_AUTHOR,
  };
}

/**
 * Remet une sauvegarde au format des étapes présentes : données manquantes complétées par initial(),
 * étapes inconnues ignorées, étape active ramenée sur une étape accessible.
 * Renvoie null si la sauvegarde n'est pas utilisable.
 */
export function restoreSnapshot(snapshot, steps) {
  if (!isObject(snapshot) || snapshot.app !== APP_ID || typeof snapshot.subject !== "string" || !snapshot.subject.trim()) {
    return null;
  }
  const data = {};
  for (const step of steps) {
    const initial = step.initial ? step.initial() : null;
    const saved = isObject(snapshot.data) ? snapshot.data[step.id] : undefined;
    data[step.id] = isObject(initial) && isObject(saved) ? { ...initial, ...saved } : (saved ?? initial);
  }
  const ids = steps.map((s) => s.id);
  const validated = Array.isArray(snapshot.validated) ? snapshot.validated.filter((id) => ids.includes(id)) : [];
  const firstOpen = ids.find((id) => !validated.includes(id)) ?? null;
  const active =
    ids.includes(snapshot.active) && (validated.includes(snapshot.active) || snapshot.active === firstOpen)
      ? snapshot.active
      : firstOpen;
  const ui = {};
  if (isObject(snapshot.layout)) {
    for (const [id, p] of Object.entries(snapshot.layout)) {
      if (isObject(p) && Number.isFinite(p.x) && Number.isFinite(p.y)) ui[id] = { position: { x: p.x, y: p.y } };
    }
  }
  const author = isObject(snapshot.author)
    ? { firstName: String(snapshot.author.firstName ?? ""), lastName: String(snapshot.author.lastName ?? "") }
    : EMPTY_AUTHOR;
  return { subject: snapshot.subject, data, validated, active, ui, author };
}

/* ---------- Navigateur ---------- */

export function loadFromStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // stockage indisponible ou contenu illisible
  }
}

export function saveToStorage(snapshot) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false; // navigation privée, quota dépassé…
  }
}

/* ---------- Fichiers ---------- */

/** JSON sûr à placer dans une balise <script> (« < » échappé). */
export const embedJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

/** Lit la sauvegarde contenue dans un fichier exporté (.html) ou un JSON. Lève une erreur lisible sinon. */
export async function readSnapshotFile(file) {
  const text = await file.text();
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const doc = new DOMParser().parseFromString(text, "text/html");
  const el = doc.getElementById(DATA_ELEMENT_ID);
  if (!el) throw new Error("Ce fichier ne contient pas de dissertation exportée.");
  return JSON.parse(el.textContent);
}

/** Propose le téléchargement d'un texte sous forme de fichier. */
export function downloadText(filename, text, type = "text/html") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Texte réduit pour un nom de fichier : « Jean-Pierre de la Tour » → « jean-pierre-de-la-tour ». */
export function slugify(text) {
  return String(text ?? "")
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Nom du fichier exporté : nom_prenom_dissertation.html */
export const exportFileName = ({ firstName, lastName }) =>
  `${[slugify(lastName), slugify(firstName)].filter(Boolean).join("_") || "travail"}_dissertation.html`;
