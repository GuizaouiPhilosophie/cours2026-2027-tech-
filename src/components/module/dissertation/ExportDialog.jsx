import { useEffect, useRef, useState } from "react";
import useEscape from "./lib/useEscape";

const FOCUSABLE = "input, button:not([disabled])";

/**
 * Fenêtre d'export : prénom et nom de l'élève, au-dessus d'un fond sombre flouté.
 * Valider → onConfirm({ firstName, lastName }) ; Annuler, Échap ou clic sur le fond → onCancel.
 * Les deux champs sont préremplis avec le dernier export.
 */
export default function ExportDialog({ author, onConfirm, onCancel }) {
  const ref = useRef(null);
  const [firstName, setFirstName] = useState(author.firstName);
  const [lastName, setLastName] = useState(author.lastName);
  const [error, setError] = useState(null);

  useEscape(onCancel);

  // Focus rendu à l'élément d'origine (le bouton Exporter) à la fermeture.
  useEffect(() => {
    const previous = document.activeElement;
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  const submit = (e) => {
    e.preventDefault();
    const f = firstName.trim();
    const l = lastName.trim();
    if (!f || !l) {
      setError("Indiquez votre prénom et votre nom.");
      return;
    }
    onConfirm({ firstName: f, lastName: l });
  };

  // Modal : Tab reste dans la fenêtre.
  const trapFocus = (e) => {
    if (e.key !== "Tab") return;
    const items = [...ref.current.querySelectorAll(FOCUSABLE)];
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

  const edit = (setter) => (e) => {
    setter(e.target.value);
    setError(null);
  };

  return (
    <div className="dissertation-modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form
        ref={ref}
        className="dissertation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dissertation-export-title"
        onSubmit={submit}
        onKeyDown={trapFocus}
      >
        <h2 id="dissertation-export-title">Exporter</h2>

        <label className="dissertation-modal-field">
          <span>Prénom :</span>
          <input
            autoFocus={!firstName}
            value={firstName}
            autoComplete="given-name"
            onChange={edit(setFirstName)}
          />
        </label>
        <label className="dissertation-modal-field">
          <span>Nom :</span>
          <input
            autoFocus={!!firstName && !lastName}
            value={lastName}
            autoComplete="family-name"
            onChange={edit(setLastName)}
          />
        </label>

        {error && (
          <p className="dissertation-modal-error" role="alert">
            {error}
          </p>
        )}

        <div className="dissertation-modal-actions">
          <button type="button" className="dissertation-modal-cancel" onClick={onCancel}>
            Annuler
          </button>
          <button type="submit" className="dissertation-validate" autoFocus={!!firstName && !!lastName}>
            Valider
          </button>
        </div>
      </form>
    </div>
  );
}
