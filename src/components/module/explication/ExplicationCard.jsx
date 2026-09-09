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
      <div className="explication-card-grip" onPointerDown={onGripPointerDown} title={gripTitle}>
        ⠿
      </div>
      <div className="explication-card-fields">
        <Field spec={title} defaultClassName="explication-card-title" defaultRows={1} />
        <Field spec={description} defaultClassName="explication-card-desc" defaultRows={2} />
      </div>
    </div>
  );
}