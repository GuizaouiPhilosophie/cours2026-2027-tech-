import { getImageUrl } from "../../lib/loadImages";

/**
 * Image de corpus, intégrée au fil du cours.
 *
 * Usage dans une séance :
 *   [[image:platon-mondes]]
 *   [[image:platon-mondes|Les deux mondes chez Platon]]              (légende)
 *   [[image:platon-mondes|width:50%]]                                (redimensionnée)
 *   [[image:platon-mondes|align:left]]                               (flotte à gauche)
 *   [[image:platon-mondes|align:right|width:35%]]                    (flotte à droite)
 *   [[image:platon-mondes|source:https://...]]                       (lien Source)
 *   [[image:platon-mondes|Les deux mondes|align:left|width:35%|source:https://...]]  (tout combiné)
 *
 * `align` : "left", "right" ou "center" (défaut). En "left"/"right" l'image
 * flotte et le texte qui suit s'écrit à côté — pratique pour les images
 * verticales. En "center" (ou si absent), l'image reste seule sur sa ligne.
 *
 * `width` accepte n'importe quelle valeur CSS valide ("50%", "300px"...).
 * Par défaut : pleine largeur en "center", ~45% en "left"/"right" (voir
 * index.css).
 *
 * Le fichier correspondant doit exister dans corpus/images/<id>.<ext>
 * (jpg, jpeg, png, gif, svg ou webp).
 */
export default function CorpusImage({ id, caption, width, source, align = "center" }) {
  const src = getImageUrl(id);

  if (!src) {
    return <p className="error-state">Image introuvable : {id}</p>;
  }

  const alignClass = ["left", "right", "center"].includes(align) ? align : "center";

  return (
    <figure
      className={`corpus-image corpus-image--${alignClass}`}
      style={width ? { "--corpus-image-width": width } : undefined}
    >
      <img src={src} alt={caption || id} loading="lazy" />
      {(caption || source) && (
        <figcaption>
          {caption}
          {caption && source && " — "}
          {source && (
            <a className="corpus-image-source" href={source} target="_blank" rel="noreferrer">
              Source
            </a>
          )}
        </figcaption>
      )}
    </figure>
  );
}
