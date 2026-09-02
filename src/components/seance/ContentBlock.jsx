/**
 * Bloc de contenu générique délimité dans le markdown par ::: type ... :::
 * (ex: exercice, definition). Le rendu visuel est piloté entièrement par
 * CSS via la classe `bloc-<type>` ; ce composant ne fait qu'appliquer le
 * bon habillage (classe + titre) autour du contenu déjà rendu.
 *
 * Si aucun titre n'est donné dans le markdown, un libellé par défaut est
 * utilisé selon le type (ex: "Exercice"). Pour un type inconnu, le type
 * lui-même est capitalisé et utilisé comme libellé.
 */
const DEFAULT_LABELS = {
  exercice: "Exercice",
  definition: "Définitions",
};

export default function ContentBlock({ type, title, children }) {
  const label = title || DEFAULT_LABELS[type];

  return (
    <div className={`bloc bloc-${type}`}>
      {label && <p className="bloc-titre">{label}</p>}
      <div className="bloc-content">{children}</div>
    </div>
  );
}