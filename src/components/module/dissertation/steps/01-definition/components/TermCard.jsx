import TermLink from "./TermLink";

/** Fiche d'un terme : définition, exemple, concepts associés, voir aussi. */
export default function TermCard({ term, onConsult, footer, showLinks = true }) {
  const associes = term.associes ?? [];
  const voirAussi = term.voir_aussi ?? [];

  return (
    <article className="dissertation-termcard">
      <header>
        <h3>{term.terme}</h3>
        {term.repere && <span className="dissertation-termcard-repere">Repère : {term.repere}</span>}
      </header>

      <p>{term.definition}</p>
      {term.exemple && <p className="dissertation-termcard-ex">Ex. : {term.exemple}</p>}
      {term.auteur && <p className="dissertation-termcard-ex">Chez {term.auteur}</p>}

      {showLinks && associes.length > 0 && (
        <div className="dissertation-termcard-group">
          <span>Concepts associés</span>
          <div className="dissertation-chips">
            {associes.map((id) => (
              <TermLink key={id} id={id} onClick={onConsult} />
            ))}
          </div>
        </div>
      )}

      {showLinks && voirAussi.length > 0 && (
        <div className="dissertation-termcard-group">
          <span>Voir aussi</span>
          <div className="dissertation-chips">
            {voirAussi.map((id) => (
              <TermLink key={id} id={id} onClick={onConsult} />
            ))}
          </div>
        </div>
      )}

      {footer}
    </article>
  );
}