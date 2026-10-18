import { useMemo, useState } from "react";
import { byId, filterGlossary } from "../lib/definitions";
import useEscape from "../../../lib/useEscape";
import Glossary from "../components/Glossary";
import TermCard from "../components/TermCard";

/** Fenêtre de consultation du glossaire (liste + fiche avec associés / voir aussi). */
function GlossaryDialog({ onClose }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const terms = useMemo(() => filterGlossary(query), [query]);
  const selected = selectedId ? byId.get(selectedId) : null;

  useEscape(onClose);

  return (
    <div
      className="dissertation-dialog-backdrop"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="dissertation-dialog" role="dialog" aria-modal="true" aria-label="Glossaire">
        <header className="dissertation-dialog-head">
          <h2>Glossaire</h2>
          <button type="button" className="dissertation-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>

        <input
          type="search"
          className="dissertation-dialog-search"
          autoFocus
          value={query}
          placeholder="Chercher un terme…"
          aria-label="Chercher un terme"
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="dissertation-dialog-body">
          <Glossary terms={terms} selectedId={selectedId} onSelect={(t) => setSelectedId(t.id)} />
          {selected ? (
            <TermCard term={selected} onConsult={setSelectedId} />
          ) : (
            <p className="dissertation-tools-empty">
              Choisissez un terme pour voir ses concepts associés et ses « voir aussi ».
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export default {
  id: "glossaire",
  label: "Glossaire",
  icon: "📖",
  description: "Parcourir les termes et leurs définitions",
  order: 10,
  Component: GlossaryDialog,
};
