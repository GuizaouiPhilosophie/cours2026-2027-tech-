import { useState } from "react";
import { Link } from "react-router-dom";

export default function SequenceAccordion({ sequence, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`sequence${open ? " open" : ""}`}>
      <div className="sequence-header" onClick={() => setOpen((o) => !o)}>
        <div className="sequence-title-group">
          <h2>{sequence.titre || sequence.id}</h2>
          <div className="sequence-notions">
            {(sequence.notions || []).map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        </div>
        <div className="chevron" />
      </div>

      <div className="seance-list">
        {sequence.seances.length === 0 && (
          <p className="empty-state" style={{ padding: "1rem 1.5rem" }}>
            Aucune séance pour l'instant.
          </p>
        )}
        {sequence.seances.map((s) => (
          <Link key={s.id} to={`/sequence/${sequence.dossier}/seance/${s.id}`}>
            <span className="seance-number">Séance {s.numero ?? "?"}</span>
            <span>{s.titre || s.id}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
