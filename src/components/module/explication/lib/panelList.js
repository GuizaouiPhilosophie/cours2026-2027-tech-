/**
 * Logique partagée du panneau du bas (liste de cards, un item par
 * instance de l'outil dans le texte) : ordre indépendant du texte
 * (choisi par l'utilisateur, conservé entre deux rendus), rebond d'une
 * card ciblée (`bounceTarget`, voir ExplicationEditor.jsx) et
 * réordonnancement par glisser-déposer d'une card. Un outil (mouvement,
 * concept...) n'a qu'à fournir sa liste d'items courants + un id unique
 * par item ; le reste (état, drag, timers) est géré ici, identique pour
 * tous.
 */

import { useEffect, useRef, useState } from "react";
import { startFreeDrag, trashHitTest, clearTrashHighlight } from "./grab";

/**
 * @param {Function} [onDelete]  appelé avec l'id de l'item si sa card est lâchée sur la poubelle
 *                                (`.explication-trash`, voir ExplicationEditor.jsx) — à cet outil
 *                                de décider ce que "supprimer" veut dire (dé-envelopper un Concept,
 *                                retirer une paire de Mouvement, un groupe d'Exemple...), exactement
 *                                comme `onDelete` dans startGrab (lib/grab.js) pour un objet posé
 *                                dans le texte. Sans `onDelete` fourni, lâcher sur la poubelle se
 *                                comporte comme un lâcher normal (réordonnancement seulement).
 */
export function usePanelList({ items, idKey = "id", toolId, version, bounceTarget, onDelete }) {
  const ids = items.map((it) => it[idKey]);
  const byId = new Map(items.map((it) => [it[idKey], it]));

  const [order, setOrder] = useState(ids);
  const orderRef = useRef(order);
  const cardRefs = useRef(new Map());
  const [bouncingId, setBouncingId] = useState(null);

  // On garde le choix de l'utilisateur : les items disparus sont
  // retirés, les nouveaux ajoutés à la fin.
  useEffect(() => {
    setOrder((prev) => {
      const kept = prev.filter((id) => byId.has(id));
      const known = new Set(kept);
      return [...kept, ...ids.filter((id) => !known.has(id))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    if (!bounceTarget || bounceTarget.toolId !== toolId) return;
    setBouncingId(bounceTarget.id);
    const t = setTimeout(() => setBouncingId((p) => (p === bounceTarget.id ? null : p)), 650);
    return () => clearTimeout(t);
  }, [bounceTarget, toolId]);

  function nearestIndex(id, clientX, clientY) {
    const positions = orderRef.current
      .filter((p) => p !== id)
      .map((p) => {
        const el = cardRefs.current.get(p);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { id: p, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      })
      .filter(Boolean);
    if (positions.length === 0) return 0;

    let nearest = positions[0];
    let best = Infinity;
    positions.forEach((p) => {
      const d = (p.cx - clientX) ** 2 + (p.cy - clientY) ** 2;
      if (d < best) [best, nearest] = [d, p];
    });
    const idx = positions.indexOf(nearest);
    return clientX < nearest.cx ? idx : idx + 1;
  }

  // Réordonnancement d'une card par glisser-déposer (grip) : même
  // mécanique de fantôme que startGrab, mais libre (voir startFreeDrag) —
  // on décide nous-mêmes de la nouvelle position à chaque mousemove
  // (distance euclidienne à la card la plus proche, cf. nearestIndex).
  // Survoler la poubelle pendant ce drag suspend le réordonnancement
  // (comme startGrab suspend la résolution de Range dans le texte) ; la
  // lâcher dessus appelle `onDelete`, pour supprimer ce à quoi la card
  // est reliée dans le texte, pas juste la retirer de cette liste.
  function startCardDrag(id) {
    return (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cardEl = cardRefs.current.get(id);
      if (!cardEl) return;

      const ghost = cardEl.cloneNode(true);
      ghost.classList.add("explication-card--ghost");
      ghost.style.setProperty("--ghost-width", `${cardEl.getBoundingClientRect().width}px`);

      let overTrash = false;

      startFreeDrag({
        ghostContent: ghost,
        sourceEl: cardEl,
        event: e,
        onMove(ev) {
          overTrash = trashHitTest(ev.clientX, ev.clientY).over;
          if (overTrash) return; // pas de réordonnancement pendant le survol de la poubelle
          const idx = nearestIndex(id, ev.clientX, ev.clientY);
          setOrder((prev) => {
            const without = prev.filter((p) => p !== id);
            without.splice(Math.max(0, Math.min(idx, without.length)), 0, id);
            return without;
          });
        },
        onEnd() {
          clearTrashHighlight();
          if (overTrash) onDelete?.(id);
        },
      });
    };
  }

  function setCardRef(id) {
    return (el) => {
      if (el) cardRefs.current.set(id, el);
      else cardRefs.current.delete(id);
    };
  }

  return { order, byId, bouncingId, startCardDrag, setCardRef };
}