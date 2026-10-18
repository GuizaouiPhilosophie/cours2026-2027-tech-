import Bubble from "../../../lib/Bubble";

/**
 * Bulle d'une contradiction : les deux éléments reliés, puis le commentaire (enregistré à
 * chaque frappe). Sans commentaire, seul le lien rouge existe ; avec, un nœud d'intersection apparaît.
 * `ends` : [{ label, text? }, { label, text? }]
 */
export default function ContradictionBubble({ title, ends, anchor, text, readOnly, onChange, onRename, onDelete, onClose }) {
  return (
    <Bubble
      anchor={anchor}
      title={title?.trim() || "Contradiction"}
      onRename={onRename}
      renamePlaceholder="Contradiction"
      onClose={onClose}
    >
      <div className="dissertation-contra-ends">
        {ends.map((e, i) => (
          <div key={i} className="dissertation-contra-end">
            <strong>{e.label}</strong>
            {e.text?.trim() && <p>{e.text}</p>}
          </div>
        ))}
      </div>

      <label className="dissertation-field dissertation-field-grow">
        <span>{readOnly ? "Commentaire" : "Votre commentaire"}</span>
        <textarea
          autoFocus={!readOnly}
          rows={5}
          value={text}
          readOnly={readOnly}
          placeholder="En quoi se contredisent-ils ? (facultatif : sans texte, seul le lien est conservé)"
          onChange={(e) => onChange(e.target.value)}
        />
      </label>

      {!readOnly && (
        <button type="button" className="dissertation-contra-delete" onClick={onDelete}>
          Supprimer le lien
        </button>
      )}
    </Bubble>
  );
}
