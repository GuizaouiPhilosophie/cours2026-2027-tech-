import "./ui.css";

/**
 * Mise en page « atelier » d'une bulle (className="is-workspace" sur la Bubble) :
 *  - grand écran : matériaux à gauche, écriture à droite ;
 *  - plein écran mobile : vertical, sans défilement vertical ; les rangées de cartes et de
 *    pastilles défilent horizontalement, la zone d'écriture prend la place restante.
 */
export function Workspace({ sources, children }) {
  return (
    <div className="dissertation-ws">
      <div className="dissertation-ws-sources">{sources}</div>
      <div className="dissertation-ws-write">{children}</div>
    </div>
  );
}

/** Bloc titré de la colonne des matériaux. `hideWhenCompact` : masqué quand le clavier est ouvert. */
export function Block({ label, hideWhenCompact = false, children }) {
  return (
    <div className={`dissertation-block${hideWhenCompact ? " is-optional" : ""}`}>
      <span className="dissertation-block-label">{label}</span>
      {children}
    </div>
  );
}

/** Texte de référence (sujet, problématique…). tone : "plain" | "accent" | "strong" ; lines : coupe en plein écran. */
export function RefText({ text, tone = "plain", lines = 2, empty = "Non rédigé." }) {
  return (
    <p className={`dissertation-reftext is-${tone}`} style={{ "--lines": lines }}>
      {text?.trim() ? text : <em>{empty}</em>}
    </p>
  );
}

/**
 * Rangée de cartes (verticale, ou horizontale en plein écran dans un atelier).
 * cards : [{ id, tone?, title?, note?, text, empty?, linked?, footer?, onClick?, active? }]
 */
export function CardRow({ cards, empty }) {
  if (!cards.length) return empty ? <p className="dissertation-tools-empty">{empty}</p> : null;
  return (
    <ul className="dissertation-cardrow">
      {cards.map((c) => {
        const classes = `dissertation-card is-${c.tone ?? "plain"}${c.linked ? " is-linked" : ""}${c.active ? " is-active" : ""}`;
        const body = (
          <>
            {c.title && <strong className="dissertation-card-title">{c.title}</strong>}
            {c.note && <span className="dissertation-card-note">{c.note}</span>}
            {c.text?.trim() ? <p>{c.text}</p> : <p className="is-empty">{c.empty ?? "Sans texte"}</p>}
            {c.footer}
          </>
        );
        return (
          <li key={c.id} className="dissertation-cardrow-item">
            {c.onClick ? (
              <button type="button" className={`${classes} is-button`} aria-pressed={!!c.active} onClick={c.onClick}>
                {body}
              </button>
            ) : (
              <div className={classes}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
