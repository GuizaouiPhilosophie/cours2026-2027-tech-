import { loadSequences } from "../lib/loadSequences";
import SequenceAccordion from "../components/SequenceAccordion";

export default function Home() {
  const sequences = loadSequences();

  return (
    <>
      <header className="site-header">
        <p className="eyebrow">Learning Portal</p>
        <h1 className="site-title">Philosophie</h1>
        <p className="tagline">Programme des séquences et séances du cours</p>
      </header>

      <main className="container">
        {sequences.length === 0 ? (
          <p className="empty-state">Aucune séquence pour le moment.</p>
        ) : (
          sequences.map((seq, i) => (
            <SequenceAccordion key={seq.dossier} sequence={seq} defaultOpen={i === 0} />
          ))
        )}
      </main>
    </>
  );
}
