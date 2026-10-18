import { Link } from "react-router-dom";

/**
 * Bouton de lien dans une séance (ex : vers le module dissertation).
 *
 * Usage dans une séance :
 *   [[bouton:dissertation]]                          -> bouton « S'exercer » vers /dissertation
 *   [[bouton:dissertation|Faire une dissertation]]   -> libellé personnalisé
 *   [[bouton:dissertation|align:center]]             -> left (défaut), center ou right
 *   [[bouton:dissertation|place:titre]]              -> placé à droite du titre du cours
 *   [[bouton:lien|to:https://...]]                   -> lien externe (nouvel onglet)
 *
 * Un chemin interne passe par React Router (basename pris en compte) ;
 * une URL complète (https://…) s'ouvre dans un nouvel onglet.
 * Le style reprend celui du bouton d'en-tête (.cours-action).
 */
export default function SeanceButton({ to, label, align = "left" }) {
  const text = label || "S'exercer";
  const external = /^https?:\/\//.test(to ?? "");
  const alignClass = ["left", "center", "right"].includes(align) ? align : "left";

  return (
    <p className={`seance-bouton seance-bouton--${alignClass}`}>
      {external ? (
        <a className="cours-action" href={to} target="_blank" rel="noreferrer">
          {text}
        </a>
      ) : (
        <Link className="cours-action" to={to}>
          {text}
        </Link>
      )}
    </p>
  );
}

/**
 * Cible d'un shortcode [[bouton:id|...]] : le paramètre `to` s'il est
 * fourni, sinon la route interne "/<id>".
 */
export function buttonTarget(part) {
  return part.params.to || `/${part.id}`;
}

/** Le bouton doit-il aller à côté du titre plutôt que dans le texte ? */
export function isTitleButton(part) {
  return part.type === "bouton" && ["titre", "title"].includes(part.params.place);
}