/**
 * Parseur BibTeX volontairement minimal : gère les valeurs entre {..} avec
 * accolades imbriquées (utile pour `abstract`), les valeurs entre "..",
 * et les valeurs nues (nombres). Suffisant pour un export Zotero standard,
 * pas destiné à couvrir tout le spec BibTeX.
 */
export function parseBibtex(raw) {
  const entries = {};
  let i = 0;

  while (i < raw.length) {
    const at = raw.indexOf("@", i);
    if (at === -1) break;

    const braceOpen = raw.indexOf("{", at);
    if (braceOpen === -1) break;

    const type = raw.slice(at + 1, braceOpen).trim().toLowerCase();

    // trouve l'accolade fermante correspondante (comptage de profondeur)
    let depth = 1;
    let j = braceOpen + 1;
    while (j < raw.length && depth > 0) {
      if (raw[j] === "{") depth++;
      else if (raw[j] === "}") depth--;
      j++;
    }

    const body = raw.slice(braceOpen + 1, j - 1);
    const commaIdx = body.indexOf(",");
    const key = body.slice(0, commaIdx).trim();
    const fields = parseFields(body.slice(commaIdx + 1));

    entries[key] = { type, key, ...fields };
    i = j;
  }

  return entries;
}

function parseFields(str) {
  const fields = {};
  let i = 0;

  while (i < str.length) {
    while (i < str.length && /[\s,]/.test(str[i])) i++;
    if (i >= str.length) break;

    const eq = str.indexOf("=", i);
    if (eq === -1) break;

    const name = str.slice(i, eq).trim().toLowerCase();
    i = eq + 1;
    while (i < str.length && /\s/.test(str[i])) i++;

    let value = "";

    if (str[i] === "{") {
      let depth = 1;
      const start = i + 1;
      i++;
      while (i < str.length && depth > 0) {
        if (str[i] === "{") depth++;
        else if (str[i] === "}") depth--;
        i++;
      }
      value = str.slice(start, i - 1);
    } else if (str[i] === '"') {
      i++;
      const start = i;
      while (i < str.length && str[i] !== '"') i++;
      value = str.slice(start, i);
      i++;
    } else {
      const start = i;
      while (i < str.length && str[i] !== ",") i++;
      value = str.slice(start, i);
    }

    fields[name] = value.trim();
  }

  return fields;
}

/**
 * "Descartes, René" -> "Descartes" ; "Platon" -> "Platon" ; gère plusieurs
 * auteurs séparés par " and ". On n'affiche que le nom de famille, pour
 * rester cohérent avec les métadonnées déjà utilisées dans CorpusText.
 */
export function formatAuthors(authorField) {
  if (!authorField) return undefined;
  return authorField
    .split(" and ")
    .map((a) => a.split(",")[0].trim())
    .join(", ");
}

export function extractYear(dateField) {
  if (!dateField) return undefined;
  const match = dateField.match(/\d{4}/);
  return match ? match[0] : dateField;
}

/**
 * Auteur complet "Nom, Prénom" -> "Prénom Nom", pour la bibliographie
 * (contrairement à formatAuthors, utilisé dans la marge du corpus, qui
 * n'affiche volontairement que le nom de famille).
 */
function formatAuthorsFull(authorField) {
  if (!authorField) return undefined;
  return authorField
    .split(" and ")
    .map((a) => {
      const [last, first] = a.split(",").map((s) => s.trim());
      return first ? `${first} ${last}` : last;
    })
    .join(", ");
}

/**
 * Construit une ligne de bibliographie lisible à partir d'un enregistrement
 * .bib brut (tel que renvoyé par parseBibtex). Reste volontairement simple
 * (pas de style APA/Chicago strict) : auteur, titre, contenant (revue ou
 * ouvrage collectif), éditeur, année, pages.
 *
 * `entry` peut être undefined (clé Zotero absente/introuvable) : on renvoie
 * alors null, à charge de l'appelant de proposer un fallback.
 */
export function formatCitation(entry) {
  if (!entry) return null;

  const authors = formatAuthorsFull(entry.author) || formatAuthorsFull(entry.editor);
  const year = extractYear(entry.date || entry.year);
  const container = entry.journaltitle || entry.journal || entry.booktitle;
  const publisher = [entry.publisher, entry.address].filter(Boolean).join(", ");

  const parts = [];
  if (authors) parts.push(authors);
  if (entry.title) parts.push(`« ${entry.title} »`);
  if (container) parts.push(container);
  if (entry.volume) parts.push(`vol. ${entry.volume}`);
  if (publisher) parts.push(publisher);
  if (year) parts.push(year);
  if (entry.pages) parts.push(`p. ${entry.pages}`);

  return parts.length > 0 ? parts.join(", ") + "." : null;
}