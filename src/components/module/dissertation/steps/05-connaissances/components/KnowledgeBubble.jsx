import Bubble from "../../../lib/Bubble";

/**
 * Bulle d'une connaissance : le texte (enregistré à chaque frappe), puis ses connexions,
 * chacune supprimable, et le bouton pour en créer une nouvelle.
 * `connections` : [{ lid, label, text? }]
 */
export default function KnowledgeBubble({
  anchor,
  title,
  text,
  exists,
  readOnly,
  connections,
  onChange,
  onRename,
  onLink,
  onUnlink,
  onDelete,
  onClose,
}) {
  const canLink = !readOnly && text.trim() !== "";

  return (
    <Bubble
      anchor={anchor}
      title={title?.trim() || "Connaissance"}
      onRename={onRename}
      renamePlaceholder="Connaissance"
      onClose={onClose}
    >
      <label className="dissertation-field dissertation-field-grow">
        <span>Ce que vous savez</span>
        <textarea
          autoFocus={!readOnly}
          rows={4}
          value={text}
          readOnly={readOnly}
          placeholder="Une notion, un auteur, un exemple, une référence de cours…"
          onChange={(e) => onChange(e.target.value)}
        />
      </label>

      <div className="dissertation-know-block">
        <span>Connexions ({connections.length})</span>
        {connections.length === 0 ? (
          <p className="dissertation-tools-empty">
            {readOnly ? "Aucune connexion." : "Reliez cette connaissance à un mot défini, une contradiction…"}
          </p>
        ) : (
          <ul className="dissertation-know-links">
            {connections.map((c) => (
              <li key={c.lid} className="dissertation-know-link">
                <div>
                  <strong>{c.label}</strong>
                  {c.text?.trim() && <p>{c.text}</p>}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    className="dissertation-know-unlink"
                    onClick={() => onUnlink(c.lid)}
                    aria-label={`Supprimer le lien avec « ${c.label} »`}
                    title="Supprimer le lien"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!readOnly && (
        <div className="dissertation-know-actions">
          <button
            type="button"
            className="dissertation-know-btn is-link"
            onClick={onLink}
            disabled={!canLink}
            title={canLink ? undefined : "Écrivez d'abord votre connaissance"}
          >
            Relier à un nœud
          </button>
          {exists && (
            <button type="button" className="dissertation-know-btn is-delete" onClick={onDelete}>
              Supprimer
            </button>
          )}
        </div>
      )}
    </Bubble>
  );
}
