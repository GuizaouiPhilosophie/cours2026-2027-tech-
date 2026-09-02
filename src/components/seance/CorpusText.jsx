import { useEffect, useId, useRef, useState } from "react";

/**
 * Extrait de corpus, intégré au fil du cours (DOM normal, annotable
 * normalement par un client d'annotation type Hypothesis si besoin —
 * il n'y a plus de Shadow DOM ni de canvas à contourner).
 *
 * Replié (par défaut) :
 *  - seules les deux premières lignes sont pleinement visibles ;
 *  - la troisième ligne est progressivement floutée (dégradé de flou,
 *    pas un simple fondu d'opacité) pour signaler qu'il y a une suite.
 * Un bouton "Déplier / Réduire" bascule l'affichage du texte entier.
 *
 * Les métadonnées du texte (auteur, œuvre, date, source...) s'affichent
 * dans une marge à gauche, façon note marginale, alignée sur le texte.
 */
export default function CorpusText({ meta = {}, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const rootRef = useRef(null);

  // Si une annotation Hypothesis ciblant ce texte est mise en avant (survol
  // ou clic depuis la sidebar) alors que le texte est replié, on le déplie
  // et on rescrolle dessus : l'ouverture du bloc déplace le contenu, donc la
  // position calculée par Hypothesis avant l'ouverture n'est plus la bonne.
  useEffect(() => {
    function handleReveal(e) {
      const target = e.detail?.target;
      if (!target || !rootRef.current?.contains(target)) return;

      setOpen(true);
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }

    document.addEventListener("philosite:reveal-corpus", handleReveal);
    return () => document.removeEventListener("philosite:reveal-corpus", handleReveal);
  }, []);

  const { auteur, oeuvre, date, source, ...restMeta } = meta;

  return (
    <figure className="corpus-text" ref={rootRef}>
      <figcaption className="corpus-meta">
        {auteur && <span className="corpus-meta-auteur">{auteur}</span>}
        {oeuvre && <cite className="corpus-meta-oeuvre">{oeuvre}</cite>}
        {date && <span className="corpus-meta-date">{date}</span>}
        {source && (
          <a className="corpus-meta-source" href={source} target="_blank" rel="noreferrer">
            Source
          </a>
        )}
        {Object.entries(restMeta).map(([key, value]) => (
          <span className="corpus-meta-extra" key={key}>
            {value}
          </span>
        ))}
      </figcaption>

      <div className="corpus-main">
        <div className={`corpus-body-wrap ${open ? "is-open" : "is-closed"}`}>
          <div id={bodyId} className={`corpus-body ${open ? "is-open" : "is-closed"}`}>
            {children}
          </div>
          {!open && <div className="corpus-fade" aria-hidden="true" />}
        </div>

        <button
          type="button"
          className="corpus-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "↑" : "↓"}
        </button>
      </div>
    </figure>
  );
}