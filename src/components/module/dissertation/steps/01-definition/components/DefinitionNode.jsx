import { useState } from "react";
import { useDefinitions } from "../context";
import { byId } from "../lib/definitions";
import { childNodeId } from "../lib/placement";
import NodeHandles from "../../../lib/NodeHandles";
import TermLink from "./TermLink";

function Links({ label, ids, pickedId, onPick }) {
  if (!ids?.length) return null;
  return (
    <div className="dissertation-defnode-group">
      <span>{label}</span>
      <div className="dissertation-chips">
        {ids.map((id) => (
          <TermLink key={id} id={id} active={id === pickedId} onClick={onPick} />
        ))}
      </div>
    </div>
  );
}

/**
 * Nœud de la carte mentale : une définition d'un mot (ou un concept associé, data.child).
 * Un clic ouvre sa bulle (géré par le Provider via les événements du canevas).
 * Si elle vient du glossaire, « Voir plus » affiche les concepts associés et « voir aussi » ;
 * une pastille montre sa définition, avec un bouton pour la créer comme nouveau nœud relié à celui-ci.
 */
export default function DefinitionNode({ id, data }) {
  const { children, createChild, editable } = useDefinitions();
  const term = data.source ? byId.get(data.source) : null;
  const [expanded, setExpanded] = useState(false);
  const [pickedId, setPickedId] = useState(null);
  const hasLinks = !!term && (term.associes?.length > 0 || term.voir_aussi?.length > 0);

  const picked = pickedId ? byId.get(pickedId) : null;
  const exists = !!picked && !!children[childNodeId(id, picked.id)];
  const pick = (termId) => setPickedId((cur) => (cur === termId ? null : termId));

  return (
    <div className={`dissertation-defnode${data.child ? " is-child" : ""}`}>
      <NodeHandles />
      <div className="dissertation-defnode-head">
        <strong>
          {data.label}
          {data.titled && data.word && <span className="dissertation-defnode-word">lié à « {data.word} »</span>}
        </strong>
        {hasLinks && (
          <button
            type="button"
            className="dissertation-defnode-toggle nodrag nopan"
            aria-expanded={expanded}
            onClick={() => {
              setExpanded((v) => !v);
              setPickedId(null);
            }}
          >
            {expanded ? "Réduire" : "Voir plus"}
          </button>
        )}
      </div>
      <p>{data.text}</p>

      {hasLinks && expanded && (
        <div className="dissertation-defnode-links nodrag nopan">
          <Links label="Concepts associés" ids={term.associes} pickedId={pickedId} onPick={pick} />
          <Links label="Voir aussi" ids={term.voir_aussi} pickedId={pickedId} onPick={pick} />

          {picked && (
            <div className="dissertation-defnode-preview">
              <strong>{picked.terme}</strong>
              <p>{picked.definition}</p>
              <button
                type="button"
                className="dissertation-defnode-create"
                disabled={exists || !editable}
                onClick={() => createChild(id, picked)}
              >
                {exists ? "Déjà sur la carte" : "Créer un nœud"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
