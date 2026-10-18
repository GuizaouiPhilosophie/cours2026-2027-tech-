import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useEscape from "./useEscape";
import useSheetViewport from "./useSheetViewport";
import { NARROW } from "./canvas";
import "./ui.css";

const COMPACT_H = 560; // plein écran plus bas que ça (clavier ouvert) : classe is-compact
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

/** Largeur de la fenêtre, suivie (rotation d'écran, redimensionnement). */
function useViewportWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

/** Sous (ou au-dessus de) l'ancre sur grand écran ; plein écran (« feuille ») sur petit écran. */
function place(anchor, width, vw, vh) {
  if (!anchor || vw < NARROW) return { sheet: true };

  const w = Math.min(width, vw - 16);
  const left = clamp(anchor.x - w / 2, 8, vw - w - 8);
  const arrow = clamp(anchor.x - left, 24, w - 24);
  const room = vh - anchor.bottom;

  return room >= 360 || room >= anchor.top
    ? { side: "below", arrow, style: { left, width: w, top: anchor.bottom + 12, maxHeight: room - 20 } }
    : { side: "above", arrow, style: { left, width: w, bottom: vh - anchor.top + 12, maxHeight: anchor.top - 20 } };
}

/** Icône crayon (modifier le titre) ou coche (valider). */
function TitleIcon({ editing }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {editing ? (
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      ) : (
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </>
      )}
    </svg>
  );
}

/**
 * Bulle commune à toutes les étapes.
 *   anchor    : { x, top, bottom } (écran) ; null = plein écran
 *   width     : largeur maximale sur grand écran
 *   title     : titre affiché (et nom accessible, sauf `label`)
 *   subtitle  : ligne discrète sous le titre (facultatif)
 *   onRename  : si présent, le titre est modifiable (crayon au bord droit, avant ×) ;
 *               reçoit le nouveau titre, "" pour revenir au titre par défaut
 *   renamePlaceholder : titre par défaut (affiché dans le champ vide ; le saisir revient à "")
 *   className : classes en plus (ex. "is-workspace", voir Workspace.jsx)
 *   onClose   : Échap, bouton ×, clic en dehors
 * Accessibilité : rôle dialog ; en plein écran elle est modale (focus piégé) ; à la fermeture,
 * le focus revient où il était si personne ne l'a pris entre-temps.
 */
export default function Bubble({
  anchor,
  width = 380,
  title,
  subtitle,
  label,
  className = "",
  onRename,
  renamePlaceholder,
  onClose,
  children,
}) {
  const ref = useRef(null);
  const vw = useViewportWidth();
  const pos = useMemo(() => place(anchor, width, vw, window.innerHeight), [anchor, width, vw]);
  const sheet = useSheetViewport(pos.sheet);
  const compact = sheet.height !== null && sheet.height < COMPACT_H;

  // Modification du titre : null = pas en cours, sinon le texte saisi.
  const [draft, setDraft] = useState(null);
  const commitTitle = useCallback(() => {
    if (draft === null) return;
    const value = draft.trim();
    // Titre inchangé : rien à enregistrer. Titre vide ou égal au titre par défaut : "".
    if (value !== title) onRename?.(value === renamePlaceholder ? "" : value);
    setDraft(null);
  }, [draft, title, renamePlaceholder, onRename]);

  // Fermer enregistre d'abord un titre en cours de modification.
  const close = useCallback(() => {
    commitTitle();
    onClose();
  }, [commitTitle, onClose]);

  useEscape(close);

  // Clic en dehors : fermer.
  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [close]);

  // Focus : dans la bulle à l'ouverture (si aucun champ ne l'a pris), rendu à la fermeture.
  useEffect(() => {
    const previous = document.activeElement;
    if (ref.current && !ref.current.contains(document.activeElement)) ref.current.focus({ preventScroll: true });
    return () => {
      const lost = !document.activeElement || document.activeElement === document.body;
      if (lost && previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  // Plein écran = modal : Tab reste dans la bulle.
  const trapFocus = (e) => {
    if (!pos.sheet || e.key !== "Tab") return;
    const items = [...ref.current.querySelectorAll(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const classes = [
    "dissertation-bubble",
    pos.sheet ? "is-sheet" : `is-${pos.side}`,
    compact && "is-compact",
    className,
  ].filter(Boolean);

  return (
    <div
      ref={ref}
      className={classes.join(" ")}
      style={pos.sheet ? sheet.style : { ...pos.style, "--arrow-x": `${pos.arrow}px` }}
      role="dialog"
      aria-modal={pos.sheet || undefined}
      aria-label={label ?? title}
      tabIndex={-1}
      onKeyDown={trapFocus}
    >
      <div className="dissertation-bubble-body">
        <div className="dissertation-bubble-head">
          <div className="dissertation-bubble-title">
            {draft === null ? (
              <h2>{title}</h2>
            ) : (
              <input
                className="dissertation-title-input"
                autoFocus
                value={draft}
                placeholder={renamePlaceholder}
                aria-label="Titre"
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTitle();
                  } else if (e.key === "Escape") {
                    e.stopPropagation(); // annule la modification sans fermer la bulle
                    setDraft(null);
                  }
                }}
              />
            )}
            {subtitle && <span className="dissertation-bubble-subtitle">{subtitle}</span>}
          </div>

          <div className="dissertation-bubble-actions">
            {onRename && (
              <button
                type="button"
                className="dissertation-close"
                // garde le focus dans le champ : le clic valide sans déclencher un second enregistrement
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (draft === null ? setDraft(title ?? "") : commitTitle())}
                aria-label={draft === null ? "Modifier le titre" : "Valider le titre"}
                title={draft === null ? "Modifier le titre" : "Valider le titre"}
              >
                <TitleIcon editing={draft !== null} />
              </button>
            )}
            <button type="button" className="dissertation-close" onClick={close} aria-label="Fermer">
              ×
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
