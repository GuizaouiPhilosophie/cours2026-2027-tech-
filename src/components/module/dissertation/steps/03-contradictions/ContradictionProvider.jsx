import { useCallback, useMemo, useState } from "react";
import "./contradiction.css";
import { ContradictionContext } from "./context";
import { contraNodeId, LINKABLE } from "./ids";
import ContradictionBubble from "./components/ContradictionBubble";
import { useWorkspace, useCanvasEvents } from "../../lib/workspace";
import HintBar from "../../lib/HintBar";
import useEscape from "../../lib/useEscape";
import { newId, centerOf } from "../../lib/canvas";
import { rectAnchor } from "../../lib/anchor";

const STEP_ID = "contradictions";
const NODE_W = 220; // taille approximative du nœud d'intersection (unités du canevas)
const NODE_H = 90;

/** Coin haut-gauche d'un nœud d'intersection centré entre deux nœuds. */
function midpoint(a, b) {
  if (!a || !b) return { x: 0, y: 0 };
  const ca = centerOf(a);
  const cb = centerOf(b);
  return { x: (ca.x + cb.x) / 2 - NODE_W / 2, y: (ca.y + cb.y) / 2 - NODE_H / 2 };
}

/**
 * Provider de l'étape : liaison et bulle des contradictions.
 *  - étape en cours : clic sur deux nœuds (au clavier : Entrée sur chacun) pour les relier ;
 *    Échap ou clic dans le vide annule ; le crayon d'un nœud d'intersection ou un clic sur un lien rouge
 *    ouvre le commentaire ;
 *  - après validation : un clic sur un lien ou un nœud d'intersection ouvre la bulle en lecture seule.
 */
export default function ContradictionProvider({ status, data, setData, view, setView, events, children }) {
  const { api, graph } = useWorkspace();
  const [bubble, setBubble] = useState(null); // { cid, anchor }
  const editable = status === "current";
  const picked = editable ? (view.picked ?? null) : null;
  const items = data.items;

  const pick = useCallback((id) => setView({ picked: id }), [setView]);
  const open = useCallback(
    (cid, anchor) => {
      pick(null);
      setBubble({ cid, anchor });
    },
    [pick]
  );
  const close = useCallback(() => setBubble(null), []);

  useEscape(useCallback(() => picked && pick(null), [picked, pick]));

  useCanvasEvents(events, {
    onNodeClick: ({ node, anchor }) => {
      if (status === "locked") return false;
      if (editable) {
        if (!LINKABLE.has(node.data.kind)) return false;
        const id = node.id;
        if (!picked || picked === id) {
          pick(picked ? null : id); // premier nœud choisi, ou second clic dessus : annule
          return true;
        }
        const existing = Object.values(items).find(
          (c) => (c.a === picked && c.b === id) || (c.a === id && c.b === picked)
        );
        let cid = existing?.id;
        if (!cid) {
          cid = newId("c");
          const created = { id: cid, a: picked, b: id, title: "", text: "", position: null };
          setData((d) => ({ ...d, items: { ...d.items, [created.id]: created } }));
        }
        open(cid, anchor);
        return true;
      }
      if (node.data.owner !== STEP_ID) return false;
      open(node.data.cid, anchor); // après validation : lecture seule
      return true;
    },
    onEdgeClick: ({ edge, anchor }) => {
      if (status === "locked" || edge.data.owner !== STEP_ID) return false;
      open(edge.data.cid, anchor);
      return true;
    },
    onPaneClick: () => {
      if (picked) pick(null);
    },
  });

  /** Commentaire enregistré à chaque frappe ; au premier caractère, le nœud d'intersection est placé. */
  const change = (cid, text) => {
    const c = items[cid];
    if (!c) return;
    const position = c.position ?? (text.trim() ? midpoint(api.getNode(c.a), api.getNode(c.b)) : null);
    setData((d) => (d.items[cid] ? { ...d, items: { ...d.items, [cid]: { ...d.items[cid], text, position } } } : d));
  };

  /** Titre personnalisé ("" = « Contradiction »), modifiable à tout moment, même après validation. */
  const rename = (cid, title) =>
    setData((d) => (d.items[cid] ? { ...d, items: { ...d.items, [cid]: { ...d.items[cid], title } } } : d));

  /** Supprime une contradiction, ainsi que celles qui sont reliées à son nœud d'intersection. */
  const remove = (cid) => {
    setData((d) => {
      const out = { ...d.items };
      const stack = [cid];
      while (stack.length) {
        const id = stack.pop();
        delete out[id];
        for (const c of Object.values(out)) {
          if (c.a === contraNodeId(id) || c.b === contraNodeId(id)) stack.push(c.id);
        }
      }
      return { ...d, items: out };
    });
    setBubble(null);
  };

  const edit = useCallback(
    (cid, el) => {
      if (status !== "locked") open(cid, rectAnchor(el));
    },
    [status, open]
  );
  const value = useMemo(() => ({ edit: editable ? edit : null }), [editable, edit]);
  const current = bubble ? items[bubble.cid] : null;

  return (
    <ContradictionContext.Provider value={value}>
      {children}

      {editable && (
        <HintBar>
          {picked ? "Choisissez le second nœud (Échap pour annuler)." : "Cliquez sur deux nœuds pour créer une contradiction."}
        </HintBar>
      )}

      {current && (
        <ContradictionBubble
          key={current.id}
          title={current.title ?? ""}
          ends={[graph.describe(current.a), graph.describe(current.b)]}
          anchor={bubble.anchor}
          text={current.text}
          readOnly={!editable}
          onChange={(text) => change(current.id, text)}
          onRename={(title) => rename(current.id, title)}
          onDelete={() => remove(current.id)}
          onClose={close}
        />
      )}
    </ContradictionContext.Provider>
  );
}
