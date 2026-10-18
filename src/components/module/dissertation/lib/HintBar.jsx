import "./ui.css";

/** Consigne de l'étape en cours, en haut de l'écran ; `action` : bouton facultatif à côté. */
export default function HintBar({ children, action }) {
  return (
    <div className="dissertation-hintbar">
      <p className="dissertation-hint" role="status">
        {children}
      </p>
      {action}
    </div>
  );
}
