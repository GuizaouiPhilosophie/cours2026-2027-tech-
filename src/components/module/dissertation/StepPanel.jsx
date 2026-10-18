import { useState } from "react";
import steps from "./stepRegistry";
import { IoIcon } from "./lib/icons";

/**
 * Menu « Parcours de rédaction » (en bas sur mobile, à gauche sur grand écran) : un bouton
 * hamburger ouvre la frise des étapes. Les étapes validées et la première non validée sont
 * cliquables : on peut revenir sur une étape validée pour la modifier, sans perdre la suite.
 * Une étape validée qui ne passe plus sa validation (ex. élément supprimé en amont) est marquée « À revoir ».
 * Boutons Exporter / Importer : sous « Valider l'étape » sur grand écran, à sa droite sur mobile.
 */
export default function StepPanel({
  active,
  validated,
  reachable,
  warnings,
  onSelect,
  onValidate,
  onExport,
  onImport,
  notice,
  error,
}) {
  const [open, setOpen] = useState(false);
  const current = steps.find((s) => s.id === active) ?? null;
  const editingValidated = !!current && validated.includes(current.id);
  const allDone = !current && steps.length > 0;

  return (
    <div className="dissertation-dock">
      <button
        type="button"
        className={`dissertation-burger${open ? " is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="dissertation-menu"
        aria-label={open ? "Fermer le parcours de rédaction" : "Ouvrir le parcours de rédaction"}
      >
        <span className="dissertation-burger-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="dissertation-burger-label" aria-hidden={open}>
          <span className="dissertation-burger-label-inner">{current ? current.title : "Parcours terminé"}</span>
        </span>
      </button>

      <div className={`dissertation-drawer${open ? " is-open" : ""}`}>
        <nav id="dissertation-menu" className="dissertation-panel" aria-label="Parcours de rédaction">
          <div className="dissertation-panel-scroll">
            <h2 className="dissertation-panel-title">Parcours de rédaction</h2>

            <ol className="dissertation-steps">
              {steps.map((step, i) => {
                const done = validated.includes(step.id);
                const isCurrent = step.id === active;
                const warn = warnings.includes(step.id);
                const canOpen = reachable.includes(step.id) && !isCurrent;
                const state = isCurrent ? "current" : done ? "done" : "locked";

                return (
                  <li
                    key={step.id}
                    className={`dissertation-step is-${state}${done ? " is-validated" : ""}${warn ? " is-warning" : ""}`}
                  >
                    <button
                      type="button"
                      className="dissertation-step-btn"
                      disabled={!canOpen}
                      aria-current={isCurrent ? "step" : undefined}
                      onClick={() => onSelect(step.id)}
                      title={canOpen ? (done ? "Revenir à cette étape pour la modifier" : "Reprendre cette étape") : undefined}
                    >
                      <span className="dissertation-step-badge" aria-hidden="true">
                        {warn ? "!" : done ? "✓" : i + 1}
                      </span>
                      <span className="dissertation-step-title">
                        {step.title}
                        {warn && <span className="dissertation-step-warn">À revoir</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {current && (
              <div className="dissertation-step-detail">
                {editingValidated && (
                  <p className="dissertation-step-note">
                    Vous modifiez une étape déjà validée : le travail des étapes suivantes est conservé.
                  </p>
                )}

                {error && (
                  <p className="dissertation-step-error" role="alert">
                    {error}
                  </p>
                )}

              </div>
            )}

            {allDone && (
              <p className="dissertation-panel-done">
                Toutes les étapes sont validées. Choisissez une étape pour la modifier.
              </p>
            )}

            <div className={`dissertation-step-actions${current ? "" : " is-io-only"}`}>
              {current && (
                <button type="button" className="dissertation-validate" onClick={onValidate}>
                  {editingValidated ? "Valider les modifications" : "Valider l’étape"}
                </button>
              )}
              <div className="dissertation-io">
                <button
                  type="button"
                  className="dissertation-io-btn"
                  onClick={onExport}
                  aria-label="Exporter (poster HTML qui contient tout le travail)"
                  title="Exporter (poster HTML qui contient tout le travail)"
                >
                  <IoIcon kind="export" />
                </button>
                <button
                  type="button"
                  className="dissertation-io-btn"
                  onClick={onImport}
                  aria-label="Importer un travail (fichier exporté)"
                  title="Importer un travail (fichier exporté)"
                >
                  <IoIcon kind="import" />
                </button>
              </div>
            </div>

            {notice && (
              <p className={`dissertation-notice is-${notice.tone}`} role="status">
                {notice.text}
              </p>
            )}
            {steps.length === 0 && <p className="dissertation-tools-empty">Aucune étape détectée.</p>}
          </div>
        </nav>
      </div>
    </div>
  );
}
