import { useEffect, useState } from "react";
import steps from "./stepRegistry";
import { IoIcon, CheckIcon, LockIcon, ResetIcon, RecenterIcon, ArrowIcon, CloseIcon, ChevronIcon, EyeIcon } from "./lib/icons";

/** Vrai quand la fenêtre est assez large pour garder le parcours ouvert à côté de la carte. */
export const WIDE_QUERY = "(min-width: 900px)";

export function useWide() {
  const get = () => typeof window !== "undefined" && !!window.matchMedia?.(WIDE_QUERY).matches;
  const [wide, setWide] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(WIDE_QUERY);
    if (!mq) return undefined;
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

/** Pastille ronde d'une étape : validée (coche), à revoir (!), en cours / verrouillée (numéro). */
function StepBadge({ index, done, warn, current }) {
  const cls = ["dissertation-step-badge", done && !warn && !current && "is-done", warn && "is-warn", current && "is-current"]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} aria-hidden="true">
      {warn ? "!" : done && !current ? <CheckIcon /> : index + 1}
    </span>
  );
}

/** Ce qu'il manque pour valider l'étape (message de validate), ou « prête ». */
function Readiness({ message }) {
  // « … pour passer à l'étape suivante. » est implicite ici : on garde l'essentiel.
  const short = message?.replace(/\s*pour passer à l['’]étape suivante\.?$/, ".");
  return message ? (
    <p className="dissertation-readiness is-todo">
      <span className="dissertation-readiness-dot" aria-hidden="true" />
      <span>
        <strong>Pour valider :</strong> {short}
      </span>
    </p>
  ) : (
    <p className="dissertation-readiness is-ok">
      <CheckIcon />
      <span>Prête à être validée</span>
    </p>
  );
}

function ValidateButton({ editingValidated, onValidate, block = false }) {
  return (
    <button type="button" className={`dissertation-validate is-primary${block ? " is-block" : ""}`} onClick={onValidate}>
      {editingValidated ? "Valider les modifications" : "Valider l’étape"}
      <ArrowIcon />
    </button>
  );
}

function FileActions({ onExport, onImport, onHome, onPoster, compact = false }) {
  return (
    <div className={`dissertation-files${compact ? " is-compact" : ""}`}>
      <button type="button" className="dissertation-pill is-wide" onClick={onPoster} title="Voir le rendu final, sans l’exporter">
        <EyeIcon />
        Voir le poster
      </button>
      <div className="dissertation-files-row">
        <button type="button" className="dissertation-pill" onClick={onExport} title="Poster HTML qui contient tout le travail">
          <IoIcon kind="export" />
          {compact ? "Exporter" : "Exporter le poster"}
        </button>
        {compact ? (
          <button type="button" className="dissertation-pill" onClick={onImport}>
            <IoIcon kind="import" />
            Importer
          </button>
        ) : (
          <button
            type="button"
            className="dissertation-io-btn"
            onClick={onImport}
            aria-label="Importer un travail exporté"
            title="Importer un travail exporté"
          >
            <IoIcon kind="import" />
          </button>
        )}
        {compact && (
          <button
            type="button"
            className="dissertation-io-btn is-danger"
            onClick={onHome}
            aria-label="Nouvelle dissertation : efface tout le travail"
            title="Nouvelle dissertation (efface tout)"
          >
            <ResetIcon />
          </button>
        )}
      </div>
      {!compact && (
        <button type="button" className="dissertation-danger-link" onClick={onHome}>
          <ResetIcon />
          Nouvelle dissertation (efface tout)
        </button>
      )}
    </div>
  );
}

/**
 * Parcours de rédaction.
 *  - Grand écran : colonne à gauche, ouverte par défaut (repliable). L'étape en cours se déplie :
 *    consigne, ce qu'il manque pour valider, bouton Valider, étape suivante.
 *  - Petit écran : pilule en haut (« 3/7 · Titre » + progression) qui ouvre une feuille en bas ;
 *    barre du bas avec « Valider l'étape » toujours à portée de pouce.
 * En mode exemple, le parcours sert à choisir l'étape mise en avant sur la carte.
 */
export default function StepPanel({
  subject,
  active,
  validated,
  reachable,
  warnings,
  readiness,
  onSelect,
  onValidate,
  onExport,
  onImport,
  onHome,
  onRecenter,
  onPoster,
  notice,
  error,
  open,
  setOpen,
  example,
}) {
  const wide = useWide();
  const currentIndex = steps.findIndex((s) => s.id === active);
  const current = currentIndex >= 0 ? steps[currentIndex] : null;
  const next = current ? steps.slice(currentIndex + 1).find((s) => !validated.includes(s.id)) : null;
  const editingValidated = !!current && validated.includes(current.id);
  const allDone = !current && steps.length > 0;
  const doneCount = validated.length;

  // Petit écran : la feuille se referme quand on change d'étape.
  useEffect(() => {
    if (!wide) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  /* ---------- Mode exemple ---------- */

  if (example) {
    const focusIndex = steps.findIndex((s) => s.id === example.focus);
    const list = (
      <ol className="dissertation-steps is-example">
        {steps.map((step, i) => (
          <li key={step.id} className={`dissertation-step${example.focus === step.id ? " is-current" : ""}`}>
            <button
              type="button"
              className="dissertation-step-btn"
              aria-current={example.focus === step.id ? "true" : undefined}
              onClick={() => example.setFocus(step.id)}
            >
              <StepBadge index={i} done current={example.focus === step.id} />
              <span className="dissertation-step-title">{step.title}</span>
            </button>
          </li>
        ))}
      </ol>
    );

    if (wide) {
      return (
        <nav className={`dissertation-rail${open ? " is-open" : ""}`} aria-label="Étapes de l’exemple">
          <div className="dissertation-rail-head">
            <span className="dissertation-rail-title">Parcourir l’exemple</span>
          </div>
          <p className="dissertation-rail-subject">{subject}</p>
          <p className="dissertation-rail-help">Choisissez une étape : la carte met en avant ce qui a été produit à ce moment-là.</p>
          {list}
          <button type="button" className="dissertation-pill is-wide" onClick={() => example.setFocus(null)}>
            Tout afficher
          </button>
          <button type="button" className="dissertation-pill is-wide" onClick={onPoster}>
            <EyeIcon />
            Voir le poster
          </button>
        </nav>
      );
    }

    return (
      <>
        <div className="dissertation-topbar">
          <button
            type="button"
            className="dissertation-burger"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            aria-label="Choisir l’étape de l’exemple à mettre en avant"
          >
            <span className="dissertation-burger-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="dissertation-burger-text">
              <span className="dissertation-burger-label">
                {focusIndex >= 0 ? `${focusIndex + 1}/${steps.length} · ${steps[focusIndex].title}` : "Tout l’exemple"}
              </span>
            </span>
          </button>
        </div>
        {open && (
          <div className="dissertation-sheet-layer">
            <button type="button" className="dissertation-sheet-backdrop" aria-label="Fermer" onClick={() => setOpen(false)} />
            <nav className="dissertation-sheet" aria-label="Étapes de l’exemple">
              <div className="dissertation-sheet-head">
                <span className="dissertation-rail-title">Parcourir l’exemple</span>
                <button type="button" className="dissertation-close" onClick={() => setOpen(false)} aria-label="Fermer">
                  <CloseIcon />
                </button>
              </div>
              {list}
              <button type="button" className="dissertation-pill is-wide" onClick={() => example.setFocus(null)}>
                Tout afficher
              </button>
            </nav>
          </div>
        )}
      </>
    );
  }

  /* ---------- Parcours normal ---------- */

  const stepState = (step) => {
    const done = validated.includes(step.id);
    const isCurrent = step.id === active;
    const warn = warnings.includes(step.id);
    const canOpen = reachable.includes(step.id) && !isCurrent;
    const locked = !isCurrent && !done && !reachable.includes(step.id);
    return { done, isCurrent, warn, canOpen, locked };
  };

  const statusBlock = current && (
    <>
      {editingValidated && (
        <p className="dissertation-step-note">Vous modifiez une étape déjà validée : la suite est conservée.</p>
      )}
      {!error && <Readiness message={readiness} />}
      {error && (
        <p className="dissertation-step-error" role="alert">
          {error}
        </p>
      )}
    </>
  );

  if (wide) {
    return (
      <>
        {!open && (
          <button
            type="button"
            className="dissertation-burger is-floating"
            aria-expanded="false"
            aria-controls="dissertation-menu"
            onClick={() => setOpen(true)}
          >
            <span className="dissertation-burger-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="dissertation-burger-label">
              {current ? `${currentIndex + 1}/${steps.length} · ${current.title}` : "Parcours terminé"}
            </span>
          </button>
        )}
        <nav id="dissertation-menu" className={`dissertation-rail${open ? " is-open" : ""}`} aria-label="Parcours de rédaction">
          <div className="dissertation-rail-head">
            <button
              type="button"
              className="dissertation-io-btn"
              onClick={() => setOpen(false)}
              aria-label="Replier le parcours"
              title="Replier le parcours"
            >
              <ChevronIcon dir="left" />
            </button>
            <span className="dissertation-rail-title">Parcours de rédaction</span>
          </div>
          <p className="dissertation-rail-subject">{subject}</p>

          <ol className="dissertation-steps">
            {steps.map((step, i) => {
              const s = stepState(step);
              return (
                <li
                  key={step.id}
                  className={`dissertation-step${s.isCurrent ? " is-current" : ""}${s.done ? " is-validated" : ""}${s.warn ? " is-warning" : ""}${s.locked ? " is-locked" : ""}`}
                >
                  <button
                    type="button"
                    className="dissertation-step-btn"
                    disabled={!s.canOpen}
                    aria-current={s.isCurrent ? "step" : undefined}
                    onClick={() => onSelect(step.id)}
                    title={s.canOpen ? (s.done ? "Revenir à cette étape pour la modifier" : "Reprendre cette étape") : undefined}
                  >
                    <StepBadge index={i} done={s.done} warn={s.warn} current={s.isCurrent} locked={s.locked} />
                    <span className="dissertation-step-title">
                      {step.title}
                      {s.warn && <span className="dissertation-step-warn">À revoir</span>}
                    </span>
                    {s.locked && <LockIcon />}
                  </button>
                  {s.isCurrent && (
                    <div className="dissertation-step-detail">
                      {step.description && <p className="dissertation-step-desc">{step.description}</p>}
                      {statusBlock}
                      <ValidateButton editingValidated={editingValidated} onValidate={onValidate} />
                      {next && <p className="dissertation-step-next">Ensuite : {next.title}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {allDone && (
            <p className="dissertation-panel-done">Toutes les étapes sont validées. Exportez le poster, ou choisissez une étape pour la modifier.</p>
          )}

          <div className="dissertation-rail-foot">
            {notice && (
              <p className={`dissertation-notice is-${notice.tone}`} role="status">
                {notice.text}
              </p>
            )}
            <FileActions onExport={onExport} onImport={onImport} onHome={onHome} onPoster={onPoster} />
          </div>
        </nav>
      </>
    );
  }

  /* ---------- Petit écran ---------- */

  return (
    <>
      <div className="dissertation-topbar">
        <button
          type="button"
          className="dissertation-burger"
          aria-expanded={open}
          aria-controls="dissertation-menu"
          onClick={() => setOpen(!open)}
          aria-label={
            current
              ? `Ouvrir le parcours, étape ${currentIndex + 1} sur ${steps.length} : ${current.title}`
              : "Ouvrir le parcours"
          }
        >
          <span className="dissertation-burger-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="dissertation-burger-text" aria-hidden="true">
            <span className="dissertation-burger-label">
              {current ? `${currentIndex + 1}/${steps.length} · ${current.title}` : "Parcours terminé"}
            </span>
            <span className="dissertation-progress">
              {steps.map((s) => (
                <span
                  key={s.id}
                  className={validated.includes(s.id) && s.id !== active ? "is-done" : s.id === active ? "is-current" : ""}
                />
              ))}
            </span>
          </span>
        </button>
      </div>

      {!open && (
        <div className="dissertation-bottombar">
          {error && current && (
            <div className="dissertation-alert" role="alert">
              <span className="dissertation-alert-icon" aria-hidden="true">!</span>
              <p>{error}</p>
            </div>
          )}
          {!error && notice && (
            <p className={`dissertation-notice is-${notice.tone} is-floating`} role="status">
              {notice.text}
            </p>
          )}
          <div className="dissertation-bottombar-row">
            <button type="button" className="dissertation-io-btn is-lg" onClick={onRecenter} aria-label="Recentrer la carte">
              <RecenterIcon />
            </button>
            {current ? (
              <ValidateButton editingValidated={editingValidated} onValidate={onValidate} block />
            ) : (
              <button type="button" className="dissertation-validate is-primary is-block" onClick={onExport}>
                <IoIcon kind="export" />
                Exporter le poster
              </button>
            )}
          </div>
        </div>
      )}

      {open && (
        <div className="dissertation-sheet-layer">
          <button type="button" className="dissertation-sheet-backdrop" aria-label="Fermer le parcours" onClick={() => setOpen(false)} />
          <nav id="dissertation-menu" className="dissertation-sheet" aria-label="Parcours de rédaction">
            <div className="dissertation-sheet-head">
              <span className="dissertation-rail-title">Parcours de rédaction</span>
              <button type="button" className="dissertation-close" onClick={() => setOpen(false)} aria-label="Fermer le parcours">
                <CloseIcon />
              </button>
            </div>

            <ol className="dissertation-frise">
              {steps.map((step, i) => {
                const s = stepState(step);
                return (
                  <li key={step.id} className={`dissertation-frise-item${s.isCurrent ? " is-current" : ""}`}>
                    <button
                      type="button"
                      className="dissertation-frise-btn"
                      disabled={!s.canOpen}
                      aria-current={s.isCurrent ? "step" : undefined}
                      aria-label={`Étape ${i + 1}, ${step.title}${s.done ? ", validée" : s.isCurrent ? ", en cours" : s.locked ? ", verrouillée" : ""}`}
                      onClick={() => onSelect(step.id)}
                    >
                      <StepBadge index={i} done={s.done} warn={s.warn} current={s.isCurrent} locked={s.locked} />
                    </button>
                  </li>
                );
              })}
            </ol>

            {current ? (
              <div className="dissertation-sheet-card">
                <span className="dissertation-sheet-count">
                  Étape {currentIndex + 1} sur {steps.length}
                </span>
                <h2>{current.title}</h2>
                {current.description && <p className="dissertation-step-desc">{current.description}</p>}
                {statusBlock}
                <ValidateButton editingValidated={editingValidated} onValidate={onValidate} block />
                {next && <p className="dissertation-step-next">Ensuite : {next.title}</p>}
              </div>
            ) : (
              <p className="dissertation-panel-done">
                {allDone ? `Les ${doneCount} étapes sont validées. Touchez une étape pour la modifier.` : ""}
              </p>
            )}

            {notice && (
              <p className={`dissertation-notice is-${notice.tone}`} role="status">
                {notice.text}
              </p>
            )}
            <FileActions onExport={onExport} onImport={onImport} onHome={onHome} onPoster={onPoster} compact />
          </nav>
        </div>
      )}
    </>
  );
}
