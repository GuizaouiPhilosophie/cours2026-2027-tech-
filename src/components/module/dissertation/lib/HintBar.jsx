import { createContext, useContext } from "react";
import "./ui.css";

/**
 * Position de l'étape en cours dans le parcours, fournie par l'éditeur : { index, total } (index à partir de 1),
 * ou null (aucune étape en cours, mode exemple…). Sert au badge « 3 / 7 » de la consigne.
 */
export const StepInfoContext = createContext(null);

/** Consigne de l'étape en cours, en haut de l'écran ; `action` : bouton facultatif à côté. */
export default function HintBar({ children, action }) {
  const info = useContext(StepInfoContext);
  return (
    <div className="dissertation-hintbar">
      <p className="dissertation-hint" role="status">
        {info && (
          <span className="dissertation-hint-step" aria-label={`Étape ${info.index} sur ${info.total}`}>
            {info.index} / {info.total}
          </span>
        )}
        <span className="dissertation-hint-text">{children}</span>
      </p>
      {action}
    </div>
  );
}
