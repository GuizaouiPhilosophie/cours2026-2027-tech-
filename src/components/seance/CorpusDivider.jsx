import { getDividerUrl } from "../../lib/loadDividers";

/**
 * Séparateur décoratif entre deux sections du cours, basé sur un SVG
 * de la bibliothèque src/assets/dividers/<id>.svg.
 *
 * Usage dans une séance :
 *   [[divider:divider1]]
 *   [[divider:divider1|width:60%]]
 */
export default function CorpusDivider({ id, width }) {
  const src = getDividerUrl(id);

  if (!src) {
    return <p className="error-state">Divider introuvable : {id}</p>;
  }

  return (
    <div
      className="corpus-divider"
      style={width ? { "--divider-width": width } : undefined}
    >
      <img src={src} alt="" role="presentation" />
    </div>
  );
}