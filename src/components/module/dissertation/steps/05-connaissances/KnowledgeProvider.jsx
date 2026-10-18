import { useCallback, useState } from "react";
import "./connaissances.css";
import { knowNodeId } from "./ids";
import KnowledgeBubble from "./components/KnowledgeBubble";
import { useWorkspace, useCanvasEvents } from "../../lib/workspace";
import { newId } from "../../lib/canvas";
import HintBar from "../../lib/HintBar";
import useEscape from "../../lib/useEscape";

const STEP_ID = "connaissances";
const NODE_W = 240; // taille approximative d'un nœud de connaissance (unités du canevas)
const NODE_H = 80;

/**
 * Provider de l'étape : création, liaison et bulle des connaissances.
 *  - double-clic (ou double toucher) dans le vide, ou bouton « Ajouter » : nouvelle connaissance ;
 *    le nœud apparaît à la première frappe et disparaît si on ferme la bulle avec un texte vide ;
 *  - « Relier à un nœud » dans la bulle, puis clic (ou Entrée) sur le nœud voulu : lien bleu ;
 *  - clic sur une connaissance ou sur un lien bleu : sa bulle (lecture seule après validation).
 */
export default function KnowledgeProvider({ status, data, setData, view, setView, events, children }) {
  const { api, graph } = useWorkspace();
  const [bubble, setBubble] = useState(null); // { kid, anchor, position, title? (avant la 1re frappe) }
  const editable = status === "current";
  const picking = editable ? (view.picking ?? null) : null;
  const { items, links } = data;

  const setPicking = useCallback((kid) => setView({ picking: kid }), [setView]);
  const open = useCallback(
    (kid, anchor, position) => {
      setPicking(null);
      setBubble({ kid, anchor, position });
    },
    [setPicking]
  );

  const remove = useCallback(
    (kid) => {
      const id = knowNodeId(kid);
      setData((d) => {
        const rest = { ...d.items };
        delete rest[kid];
        return {
          items: rest,
          links: Object.fromEntries(Object.entries(d.links).filter(([, l]) => l.a !== id && l.b !== id)),
        };
      });
      setBubble(null);
    },
    [setData]
  );

  // Fermer avec un texte vide supprime la connaissance (et ses liens).
  const close = useCallback(() => {
    if (bubble && items[bubble.kid] && !items[bubble.kid].text.trim()) remove(bubble.kid);
    else setBubble(null);
  }, [bubble, items, remove]);

  useEscape(useCallback(() => picking && setPicking(null), [picking, setPicking]));

  const startNew = (anchor, position) =>
    open(newId("k"), anchor, { x: position.x - NODE_W / 2, y: position.y - NODE_H / 2 });

  useCanvasEvents(events, {
    onPaneDoubleClick: ({ anchor, position }) => {
      if (!editable) return false;
      startNew(anchor, position);
      return true;
    },
    onPaneClick: () => {
      if (picking) setPicking(null);
    },
    onNodeClick: ({ node, anchor }) => {
      if (status === "locked") return false;
      if (picking) {
        const source = knowNodeId(picking);
        if (node.id === source) {
          setPicking(null);
          return true;
        }
        const exists = Object.values(links).some(
          (l) => (l.a === source && l.b === node.id) || (l.a === node.id && l.b === source)
        );
        if (!exists) {
          const created = { id: newId("l"), a: source, b: node.id };
          setData((d) => ({ ...d, links: { ...d.links, [created.id]: created } }));
        }
        open(picking, api.nodeAnchor(source) ?? anchor);
        return true;
      }
      if (node.data.owner !== STEP_ID) return false;
      open(node.data.kid, anchor);
      return true;
    },
    onEdgeClick: ({ edge, anchor }) => {
      if (status === "locked" || edge.data.owner !== STEP_ID) return false;
      open(edge.data.kid, anchor);
      return true;
    },
  });

  const change = (text) => {
    const { kid, position, title = "" } = bubble;
    setData((d) => ({
      ...d,
      items: { ...d.items, [kid]: d.items[kid] ? { ...d.items[kid], text } : { id: kid, title, text, position } },
    }));
  };

  /** Titre personnalisé, modifiable à tout moment ; avant la première frappe, gardé pour la création. */
  const rename = (title) => {
    const { kid } = bubble;
    if (!items[kid]) return setBubble((b) => ({ ...b, title }));
    setData((d) => ({ ...d, items: { ...d.items, [kid]: { ...d.items[kid], title } } }));
  };

  const unlink = (lid) =>
    setData((d) => {
      const rest = { ...d.links };
      delete rest[lid];
      return { ...d, links: rest };
    });

  /** Connexions de la connaissance ouverte, avec le libellé du nœud relié. */
  const connections = (kid) => {
    const self = knowNodeId(kid);
    return Object.values(links)
      .filter((l) => l.a === self || l.b === self)
      .map((l) => {
        const other = l.a === self ? l.b : l.a;
        const d = graph.describe(other);
        return { lid: l.id, label: d.label, text: d.text };
      });
  };

  const addFromCenter = () => {
    const { anchor, position } = api.viewportCenter();
    startNew(anchor, position);
  };

  return (
    <>
      {children}

      {editable && (
        <HintBar
          action={
            !picking && (
              <button type="button" onClick={addFromCenter}>
                + Ajouter
              </button>
            )
          }
        >
          {picking
            ? "Choisissez le nœud à relier (Échap ou clic dans le vide pour annuler)."
            : "Double-cliquez dans le vide pour ajouter une connaissance."}
        </HintBar>
      )}

      {bubble && (
        <KnowledgeBubble
          key={bubble.kid}
          anchor={bubble.anchor}
          title={items[bubble.kid]?.title ?? bubble.title ?? ""}
          onRename={rename}
          text={items[bubble.kid]?.text ?? ""}
          exists={!!items[bubble.kid]}
          readOnly={!editable}
          connections={connections(bubble.kid)}
          onChange={change}
          onLink={() => {
            setBubble(null);
            setPicking(bubble.kid);
          }}
          onUnlink={unlink}
          onDelete={() => remove(bubble.kid)}
          onClose={close}
        />
      )}
    </>
  );
}
