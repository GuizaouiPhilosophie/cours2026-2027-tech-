import SeanceMarkdown from "../components/seance/SeanceMarkdown";

/**
 * Détection automatique des séquences/séances — SANS script de build maison.
 *
 * import.meta.glob est une fonctionnalité native de Vite : au build (et en dev),
 * Vite scanne les fichiers correspondant au motif et génère les imports
 * automatiquement. Ajouter un fichier qui matche le motif = il est détecté au
 * prochain build, sans toucher à ce fichier.
 *
 * Convention :
 *  - un dossier sous /sequences est une séquence s'il contient _sequence.json
 *  - dedans, tout fichier seance-*.md avec un bloc data-seance-meta est
 *    une séance
 *  - le corps du .md (markdown enrichi de HTML, + shortcodes [[corpus:id]])
 *    est rendu par <SeanceMarkdown> (voir components/seance/SeanceMarkdown.jsx) ;
 *    il n'y a plus de fichier .jsx par séance à écrire ou générer.
 */

const sequenceMetaModules = import.meta.glob("../../sequences/*/_sequence.json", {
  eager: true,
});

const seanceModules = import.meta.glob("../../sequences/*/seance-*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

const META_RE = /<script[^>]*data-seance-meta[^>]*>([\s\S]*?)<\/script>/i;

/**
 * Sépare le bloc JSON d'en-tête du reste du fichier (le markdown à rendre).
 * Même convention que corpus/textes/*.html (voir loadCorpusTexts.js).
 */
function parseSeanceFile(raw, filePath) {
  const match = raw.match(META_RE);
  if (!match) {
    console.warn(`⚠️  ${filePath} n'a pas de bloc <script data-seance-meta>, ignoré.`);
    return null;
  }

  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (e) {
    console.warn(`⚠️  Bloc data-seance-meta invalide dans ${filePath} :`, e);
    return null;
  }

  const markdown = (raw.slice(0, match.index) + raw.slice(match.index + match[0].length)).trim();
  return { meta, markdown };
}

/**
 * @returns {Array} liste des séquences, chacune avec ses séances, triées.
 */
export function loadSequences() {
  const sequences = [];

  for (const [filePath, mod] of Object.entries(sequenceMetaModules)) {
    // filePath ressemble à: ../../sequences/sequence-1-oeuvre-art/_sequence.json
    const dossier = filePath.split("/").slice(-2, -1)[0];
    const meta = mod.default;

    const seances = Object.entries(seanceModules)
      .filter(([seancePath]) => seancePath.includes(`/${dossier}/`))
      .map(([seancePath, raw]) => {
        const parsed = parseSeanceFile(raw, seancePath);
        if (!parsed) return null;

        const { meta: seanceMeta, markdown } = parsed;
        return {
          ...seanceMeta,
          dossier,
          Component: () => <SeanceMarkdown title={seanceMeta.titre} markdown={markdown} />,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999));

    sequences.push({ ...meta, dossier, seances });
  }

  return sequences.sort((a, b) => (a.ordre ?? 999) - (b.ordre ?? 999));
}