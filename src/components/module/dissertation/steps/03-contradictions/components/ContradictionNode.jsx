import { useContradictions } from "../context";
import TextNode from "../../../lib/TextNode";

/**
 * Nœud d'intersection : le commentaire d'une contradiction entre deux nœuds.
 * Un clic sur le nœud sert à le relier (étape en cours) ; le crayon ouvre son commentaire.
 */
export default function ContradictionNode({ data }) {
  const { edit } = useContradictions();
  return (
    <TextNode
      label={data.label}
      text={data.text}
      tone="contradiction"
      font="sans"
      width={220}
      empty="Sans commentaire"
      action={
        edit && (
          <button
            type="button"
            className="dissertation-node-action nodrag nopan"
            aria-label="Modifier le commentaire"
            title="Modifier le commentaire"
            onClick={(e) => edit(data.cid, e.currentTarget.closest(".react-flow__node") ?? e.currentTarget)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        )
      }
    />
  );
}
