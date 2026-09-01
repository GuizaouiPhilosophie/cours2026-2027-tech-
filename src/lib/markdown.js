import { marked } from "marked";

/**
 * `marked` laisse passer le HTML brut inline par défaut (gfm/html non
 * désactivés) : c'est voulu, le markdown des séances est écrit par une
 * seule personne (toi), pas par des visiteurs — pas besoin de sanitizer
 * type DOMPurify ici. Si un jour le contenu markdown peut venir d'ailleurs
 * (élèves, contributions externes...), il faudra ajouter une passe de
 * sanitization avant de faire confiance à ce HTML.
 */
marked.setOptions({
  gfm: true,
  breaks: false,
});

export function renderMarkdown(markdown) {
  return marked.parse(markdown ?? "");
}
