import { useEffect, useState } from "react";
import { parseSnapshotText } from "./persistence";

/**
 * Exemples de dissertations terminées, servis tels quels depuis public/exemple/dissertation/.
 *
 * Vite ne sait pas lister un dossier de public/ une fois le site publié : la liste vient donc d'un
 * petit index à placer à côté des fichiers, public/exemple/dissertation/index.json :
 *
 *   [
 *     { "file": "beaute-objective.html", "title": "Peut-on juger objectivement de la beauté ?" },
 *     { "file": "art-nature.html" }
 *   ]
 *
 * `file` : nom d'un poster exporté depuis l'éditeur (bouton « Exporter le poster ») ;
 * `title` : facultatif, sinon le sujet enregistré dans le fichier est utilisé une fois l'exemple ouvert.
 * Sans index (ou index vide), la section « Voir un exemple terminé » n'apparaît pas.
 */
const BASE = `${import.meta.env.BASE_URL}exemple/dissertation/`;

export function useExamples() {
  const [examples, setExamples] = useState([]);
  useEffect(() => {
    let alive = true;
    fetch(`${BASE}index.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (!alive || !Array.isArray(list)) return;
        setExamples(
          list
            .filter((e) => e && typeof e.file === "string" && e.file.trim())
            .map((e, i) => ({ file: e.file.trim(), title: typeof e.title === "string" && e.title.trim() ? e.title.trim() : `Exemple ${i + 1}` }))
        );
      })
      .catch(() => {
        /* pas d'index : pas de section exemples */
      });
    return () => {
      alive = false;
    };
  }, []);
  return examples;
}

/** Charge et lit un exemple (sauvegarde embarquée dans le poster). */
export async function loadExample(file) {
  const res = await fetch(`${BASE}${encodeURIComponent(file)}`, { cache: "no-cache" });
  if (!res.ok) throw new Error("Exemple introuvable.");
  return parseSnapshotText(await res.text());
}
