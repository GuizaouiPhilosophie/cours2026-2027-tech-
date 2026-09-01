import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { loadSequences } from "../lib/loadSequences";
import {
  loadHypothesisClient,
  setHypothesisUri,
  watchHypothesisHighlightFocus,
} from "../lib/hypothesis";

export default function SeancePage() {
  const { sequenceId, seanceId } = useParams();
  const sequences = loadSequences();

  const sequence = sequences.find((s) => s.dossier === sequenceId);
  const seance = sequence?.seances.find((s) => s.id === seanceId);

  // Hypothesis n'est chargé que sur les pages de séance (rien à annoter sur
  // l'accueil), et l'URI canonique est réajustée à chaque séance visitée
  // pour que les annotations ne se mélangent pas entre séances (HashRouter).
  useEffect(() => {
    if (!sequence || !seance) return;
    loadHypothesisClient();
    watchHypothesisHighlightFocus();
    setHypothesisUri(window.location.href);
  }, [sequence, seance]);

  if (!sequence || !seance) {
    return (
      <main className="seance-content">
        <p className="error-state">Séance introuvable.</p>
        <Link className="back-link" to="/">
          &larr; Retour au programme
        </Link>
      </main>
    );
  }

  const SeanceComponent = seance.Component;

  return (
    <div className="seance-body">
      <div className="seance-topbar">
        <Link className="back-link" to="/">
          &larr; Programme
        </Link>
        <span className="seance-crumb">
          {sequence.titre} · Séance {seance.numero} : {seance.titre}
        </span>
      </div>

      <main className="seance-content">
        {SeanceComponent ? (
          <SeanceComponent />
        ) : (
          <>
            <h1>
              Séance {seance.numero} : {seance.titre}
            </h1>
            <p className="placeholder">Contenu à venir.</p>
          </>
        )}
      </main>
    </div>
  );
}