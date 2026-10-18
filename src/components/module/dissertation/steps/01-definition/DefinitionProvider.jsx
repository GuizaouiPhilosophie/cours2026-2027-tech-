import { useCallback, useMemo, useState } from "react";
import "./definition.css";
import { DefinitionContext } from "./context";
import DefinitionBubble from "./components/DefinitionBubble";
import { placeBelow, placeChild, defNodeId, childNodeId } from "./lib/placement";
import { useWorkspace, useCanvasEvents } from "../../lib/workspace";
import { rectAnchor } from "../../lib/anchor";
import { newId } from "../../lib/canvas";

const STEP_ID = "definition";

/** Garde les concepts associés dont la chaîne de parents mène encore à une définition existante. */
function pruneChildren(children, entries) {
  const alive = new Set(
    Object.entries(entries).flatMap(([key, list]) => list.map((e) => defNodeId(key, e.id)))
  );
  const kept = {};
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of Object.values(children)) {
      if (!kept[c.id] && alive.has(c.parent)) {
        kept[c.id] = c;
        alive.add(c.id);
        changed = true;
      }
    }
  }
  return kept;
}

/**
 * Provider de l'étape : bulle de définition et actions. Le contenu (définitions, concepts associés)
 * est dans `data` ; la carte en est déduite par step.canvas.
 * Après validation, un clic sur un nœud de définition ouvre la bulle en lecture seule.
 */
export default function DefinitionProvider({ status, data, setData, setView, events, children }) {
  const { api } = useWorkspace();
  const [bubble, setBubble] = useState(null); // { key, word, defId, anchor, title? (avant la 1re frappe) }
  const editable = status === "current";

  const openWord = useCallback(
    (word, key, el, defId) => setBubble({ key, word, defId: defId ?? newId("d"), anchor: rectAnchor(el) }),
    []
  );
  const close = useCallback(() => setBubble(null), []);
  const setMenuOpen = useCallback((menuOpen) => setView({ menuOpen }), [setView]);

  useCanvasEvents(events, {
    onNodeClick: ({ node, anchor }) => {
      if (node.data.owner !== STEP_ID || node.data.child) return false;
      setBubble({ key: node.data.key, word: node.data.word, defId: node.data.defId, anchor });
      return true;
    },
  });

  /** Enregistre une définition à chaque frappe ; un texte vide la supprime (avec ses concepts associés). */
  const save = useCallback(
    (b, entry) => {
      const empty = !entry.text.trim();
      const isNew = !data.entries[b.key]?.some((e) => e.id === b.defId);
      const position = !empty && isNew ? placeBelow(api, b.anchor) : null;

      setData((d) => {
        const list = d.entries[b.key] ?? [];
        const updated = empty
          ? list.filter((e) => e.id !== b.defId)
          : list.some((e) => e.id === b.defId)
            ? list.map((e) => (e.id === b.defId ? { ...e, ...entry } : e))
            : [...list, { id: b.defId, word: b.word, title: b.title ?? "", position, ...entry }];
        const entries = { ...d.entries };
        if (updated.length) entries[b.key] = updated;
        else delete entries[b.key];
        return { entries, children: empty ? pruneChildren(d.children, entries) : d.children };
      });
    },
    [api, data.entries, setData]
  );

  /**
   * Change le terme défini (titre). Le lien reste attaché au mot du sujet. Possible à tout moment,
   * même après validation. Avant la première frappe, le titre est gardé pour la création.
   */
  const rename = useCallback(
    (b, title) => {
      const exists = data.entries[b.key]?.some((e) => e.id === b.defId);
      if (!exists) {
        setBubble((cur) => (cur && cur.defId === b.defId ? { ...cur, title } : cur));
        return;
      }
      setData((d) => ({
        ...d,
        entries: {
          ...d.entries,
          [b.key]: d.entries[b.key].map((e) => (e.id === b.defId ? { ...e, title } : e)),
        },
      }));
    },
    [data.entries, setData]
  );

  /** Crée un nœud de concept associé sous un nœud de définition. */
  const createChild = useCallback(
    (parentId, term) => {
      const id = childNodeId(parentId, term.id);
      if (data.children[id]) return;
      const position = placeChild(api, parentId);
      setData((d) =>
        d.children[id]
          ? d
          : {
              ...d,
              children: {
                ...d.children,
                [id]: { id, parent: parentId, word: term.terme, text: term.definition, source: term.id, position },
              },
            }
      );
    },
    [api, data.children, setData]
  );

  const value = useMemo(
    () => ({ entries: data.entries, children: data.children, editable, openWord, createChild, setMenuOpen }),
    [data.entries, data.children, editable, openWord, createChild, setMenuOpen]
  );

  return (
    <DefinitionContext.Provider value={value}>
      {children}
      {bubble && (
        <DefinitionBubble
          key={`${bubble.key}-${bubble.defId}`}
          word={bubble.word}
          title={data.entries[bubble.key]?.find((e) => e.id === bubble.defId)?.title ?? bubble.title ?? ""}
          anchor={bubble.anchor}
          entry={data.entries[bubble.key]?.find((e) => e.id === bubble.defId)}
          readOnly={!editable}
          onChange={(entry) => save(bubble, entry)}
          onRename={(title) => rename(bubble, title)}
          onClose={close}
        />
      )}
    </DefinitionContext.Provider>
  );
}
