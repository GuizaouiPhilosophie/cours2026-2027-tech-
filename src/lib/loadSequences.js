/**
 * Détection automatique des séquences/séances — SANS script de build maison.
 *
 * import.meta.glob est une fonctionnalité native de Vite : au build (et en dev),
 * Vite scanne les fichiers correspondant au motif et génère les imports
 * automatiquement. Ajouter un fichier qui matche le motif = il est détecté au
 * prochain build, sans toucher à ce fichier.
 *
 * Convention (inchangée) :
 *  - un dossier sous /sequences est une séquence s'il contient _sequence.json
 *  - dedans, tout fichier seance-*.jsx qui exporte `meta` est une séance
 *  - le composant par défaut de la séance est du contenu de page "normal"
 *    (voir components/seance/Cours.jsx et CorpusText.jsx)
 */

const sequenceMetaModules = import.meta.glob("../../sequences/*/_sequence.json", {
  eager: true,
});

const seanceModules = import.meta.glob("../../sequences/*/seance-*.jsx", {
  eager: true,
});

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
      .map(([seancePath, seanceMod]) => {
        if (!seanceMod.meta) {
          console.warn(`⚠️  ${seancePath} n'exporte pas \`meta\`, ignoré.`);
          return null;
        }
        return {
          ...seanceMod.meta,
          dossier,
          Component: seanceMod.default,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999));

    sequences.push({ ...meta, dossier, seances });
  }

  return sequences.sort((a, b) => (a.ordre ?? 999) - (b.ordre ?? 999));
}
