/**
 * Conteneur du cours.
 *
 * Plus de panneau canvas, plus de Shadow DOM : c'est un simple <section>
 * dans le flux normal de la page. Le texte du cours et les extraits de
 * corpus (via <CorpusText>) se succèdent normalement, comme dans une
 * page web classique.
 */
export default function Cours({ title, children, className = "" }) {
  return (
    <section className={`cours ${className}`}>
      {title ? <h1 className="cours-title">{title}</h1> : null}
      <div className="cours-body">{children}</div>
    </section>
  );
}
