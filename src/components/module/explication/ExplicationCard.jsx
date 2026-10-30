/* Card générique du panneau du bas, partagée par tous les outils.*/

import "./ExplicationCard.css";

/* ---------- champ texte auto-agrandissant ---------- */

function AutoTextarea({ value, placeholder, rows, className, onChange }) {
  return (
    <textarea
      rows={rows}
      defaultValue={value}
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        onChange?.(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      ref={(el) => {
        if (el) {
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }
      }}
    />
  );
}

/* ---------- un champ de la card : éditable (textarea) ou lecture seule ---------- */

function Field({ spec, defaultClassName, defaultRows }) {
  if (spec == null) return null;

  // Forme courte : juste une chaîne à afficher telle quelle (ex. le
  // titre d'un concept, qui n'est jamais qu'une lecture du texte entouré,
  // jamais un champ à remplir).
  if (typeof spec === "string" || typeof spec === "number") {
    return <div className={defaultClassName}>{spec}</div>;
  }

  const { value, placeholder, onChange, editable = true, className, rows } = spec;
  const cls = className || defaultClassName;

  if (!editable) {
    return <div className={cls}>{value}</div>;
  }

  return (
    <AutoTextarea
      value={value}
      placeholder={placeholder}
      rows={rows ?? defaultRows}
      className={cls}
      onChange={onChange}
    />
  );
}

/* ---------- la card elle-même ---------- */

export default function ExplicationCard({
  cardRef,
  className = "",
  accentColor,
  background,
  width,
  bouncing = false,
  onGripPointerDown,
  gripTitle = "Glisser pour réordonner",
  number,
  onLocate,
  onDelete,
  deleteLabel = "Supprimer",
  title,
  description,
}) {
  return (
    <div
      ref={cardRef}
      className={`explication-card${bouncing ? " is-bouncing" : ""}${className ? ` ${className}` : ""}`}
      style={{
        "--accent-color": accentColor,
        "--card-bg": background,
        "--card-width": width,
      }}
    >
      <div className="explication-card-head">
        {number && (
          <span className="explication-card-num" aria-hidden="true">
            {number}
          </span>
        )}
        <div className="explication-card-grip" onPointerDown={onGripPointerDown} title={gripTitle} aria-hidden="true">
          ⠿
        </div>
        {onLocate && (
          <button type="button" className="explication-card-action" onClick={onLocate} aria-label="Retrouver dans le texte" title="Retrouver dans le texte">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6" />
              <path d="M20 20l-4.5-4.5" />
            </svg>
          </button>
        )}
        {onDelete && (
          <button type="button" className="explication-card-action is-danger" onClick={onDelete} aria-label={deleteLabel} title={deleteLabel}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
            </svg>
          </button>
        )}
      </div>
      <div className="explication-card-fields">
        <Field spec={title} defaultClassName="explication-card-title" defaultRows={1} />
        <Field spec={description} defaultClassName="explication-card-desc" defaultRows={2} />
      </div>
    </div>
  );
}

/** Fait défiler le texte jusqu'à un élément et le fait brièvement clignoter (bouton « Retrouver »). */
export function locateInText(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("explication-flash");
  // reflow : relance l'animation même si on reclique tout de suite
  void el.offsetWidth;
  el.classList.add("explication-flash");
  setTimeout(() => el.classList.remove("explication-flash"), 1600);
}
