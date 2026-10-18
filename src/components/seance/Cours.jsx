import { Link } from "react-router-dom";

/**
 * Conteneur du cours.
 *
 * Plus de panneau canvas, plus de Shadow DOM : c'est un simple <section>
 * dans le flux normal de la page. Le texte du cours et les extraits de
 * corpus (via <CorpusText>) se succèdent normalement, comme dans une
 * page web classique.
 *
 * `action` (facultatif) : { to, label? } — bouton à droite du titre
 * (« S'exercer » par défaut). Un chemin interne ("/dissertation") passe par
 * React Router (le basename GitHub Pages est donc pris en compte) ; une URL
 * complète (https://…) s'ouvre dans un nouvel onglet.
 */
export default function Cours({ title, action, children, className = "" }) {
  const label = action?.label || "S'exercer";
  const external = /^https?:\/\//.test(action?.to ?? "");

  return (
    <section className={`cours ${className}`}>
      {title ? (
        <header className="cours-header">
          <h1 className="cours-title">{title}</h1>
          {action?.to &&
            (external ? (
              <a className="cours-action" href={action.to} target="_blank" rel="noreferrer">
                {label}
              </a>
            ) : (
              <Link className="cours-action" to={action.to}>
                {label}
              </Link>
            ))}
        </header>
      ) : null}
      <div className="cours-body">{children}</div>
    </section>
  );
}