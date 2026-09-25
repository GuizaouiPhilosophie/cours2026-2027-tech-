import { getPdfUrl } from "../../lib/loadPdfs";

/**
 * PDF de corpus, intégré au fil du cours dans un lecteur embarqué.
 *
 * Usage dans une séance :
 *   [[pdf:2026bactech]]
 *   [[pdf:2026bactech|Sujet bac technologique 2026]]                (légende)
 *   [[pdf:2026bactech|height:800px]]                                (hauteur du lecteur)
 *   [[pdf:2026bactech|Sujet bac technologique 2026|height:1000px]]  (combiné)
 *
 * `height` accepte n'importe quelle valeur CSS valide ("800px", "80vh"...).
 * Par défaut : 600px (voir index.css, --corpus-pdf-height).
 *
 * Le fichier correspondant doit exister dans corpus/pdf/<id>.pdf
 */
export default function CorpusPdf({ id, caption, height }) {
  const src = getPdfUrl(id);

  if (!src) {
    return <p className="error-state">PDF introuvable : {id}</p>;
  }

  return (
    <figure
      className="corpus-pdf"
      style={height ? { "--corpus-pdf-height": height } : undefined}
    >
      <object data={src} type="application/pdf" className="corpus-pdf-frame">
        <p>
          Votre navigateur ne peut pas afficher ce PDF.{" "}
          <a href={src} target="_blank" rel="noreferrer">
            Ouvrir le PDF
          </a>
        </p>
      </object>
    </figure>
  );
}