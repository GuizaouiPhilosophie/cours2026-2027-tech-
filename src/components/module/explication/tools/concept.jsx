/**
 * Outil Concept : dépose un <concept> autour d'UN mot.
 *
 * Toute la mécanique générique (contour SVG en escalier, poignées
 * gauche/droite, re-saisie du corps entier, découpage d'un Range en
 * segments par bloc <p>...) vit dans lib/groupOverlay.js — voir ce
 * fichier pour le détail du raisonnement. Ce qui reste ici est propre à
 * Concept : la forme du <concept> lui-même (définition), le widget de la
 * barre d'outils, et le panneau du bas.
 */

import { snapOnWord, snapOnWordTolerantStrict, makeId } from "../lib/grab";
import { createGroupOverlay, formatGroupTitle } from "../lib/groupOverlay";
import { usePanelList } from "../lib/panelList";
import ExplicationCard from "../ExplicationCard";
import "./concept.css";

const isTouchDevice = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

/* ---------- forme du <concept> ---------- */

function makeConceptEl(id, definition) {
  const el = document.createElement("concept");
  el.className = "explication-concept";
  el.dataset.id = id || makeId("concept");
  if (definition) el.setAttribute("definition", definition);
  return el;
}

function getDefinition(el) {
  return el?.getAttribute("definition") || "";
}

function setGroupDefinition(container, id, value) {
  Group.segmentsOf(container, id).forEach((el) => el.setAttribute("definition", value));
}

const Group = createGroupOverlay({
  tag: "concept",
  snap: snapOnWordTolerantStrict,
  createElement: makeConceptEl,
  getPayload: getDefinition,
  ghostChar: "◯",
});

/* ---------- câblage d'un segment / d'un groupe ---------- */

function wireSegment(el, id, container, helpers) {
  if (el.dataset.wired === "1") return;
  el.dataset.wired = "1";

  if (isTouchDevice()) {
    // Pas de "click" sur tactile : le touchstart de wireBodyGrab appelle
    // preventDefault (nécessaire pour bloquer le scroll natif pendant le
    // drag), ce qui supprime le click de compatibilité sur un vrai
    // appareil (voir le commentaire sur onTap dans groupOverlay.js). On
    // détecte donc le tap via onTap, seul fiable ici.
    Group.wireBodyGrab(el, id, container, helpers, (c, i) => wireGroup(c, i, helpers), () => {
      Group.attachHandlesForGroup(id, container, helpers, (c, i) => wireGroup(c, i, helpers));
      document.addEventListener("pointerdown", Group.onOutsideTap, true);
      helpers.openPanel?.("concept", id);
    });
  } else {
    Group.wireBodyGrab(el, id, container, helpers, (c, i) => wireGroup(c, i, helpers));

    const consumeClick = () => {
      if (el.dataset.justDragged !== "1") return false;
      delete el.dataset.justDragged;
      return true;
    };

    el.addEventListener(
      "mouseenter",
      () => el.dataset.justDragged !== "1" && Group.attachHandlesForGroup(id, container, helpers, (c, i) => wireGroup(c, i, helpers))
    );
    el.addEventListener("mouseleave", (e) => {
      if (e.relatedTarget?.closest?.(".explication-concept-handle")) return;
      if (e.relatedTarget?.closest?.(`concept[data-id="${id}"]`)) return;
      Group.clearHandles(container);
    });
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!consumeClick()) helpers.openPanel?.("concept", id);
    });
  }
}

function wireGroup(container, id, helpers) {
  Group.segmentsOf(container, id).forEach((el) => wireSegment(el, id, container, helpers));
}

/* ---------- barre d'outils ---------- */

function ToolbarWidget({ startDrag }) {
  return (
    <div className="explication-concept-widget">
      <span className="explication-concept-widget-label">Concept</span>
      <div className="explication-concept-chip" onPointerDown={startDrag({})} title="Entourer un mot">
        ◯
      </div>
    </div>
  );
}

/* ---------- liste des concepts, badge, panneau ---------- */

function getBadge(container) {
  const items = Group.listGroups(container);
  return items.length ? { label: "Concepts", count: items.length } : null;
}

// Titre non éditable (le texte du groupe, lu depuis le DOM) ; seule la
// définition est un champ, répliquée sur tous les segments du groupe.
function PanelContent({ containerRef, version, helpers, bounceTarget }) {
  const container = containerRef.current;
  const items = container ? Group.listGroups(container) : [];
  const { order, byId, bouncingId, startCardDrag, setCardRef } = usePanelList({
    items,
    toolId: "concept",
    version,
    bounceTarget,
    onDelete(id) {
      Group.removeGroup(container, id, helpers);
    },
  });

  if (order.length === 0) return <p className="explication-panel-empty">Aucun concept pour l’instant.</p>;

  return (
    <div className="explication-panel-list">
      {order.map((id) => {
        const it = byId.get(id);
        if (!it || !container) return null;
        return (
          <ExplicationCard
            key={id}
            cardRef={setCardRef(id)}
            className="explication-card--concept"
            accentColor="#c1694c"
            width="9rem"
            bouncing={bouncingId === id}
            onGripPointerDown={startCardDrag(id)}
            title={{ value: formatGroupTitle(it.segs), editable: false }}
            description={{
              value: getDefinition(it.segs[0]),
              placeholder: "Définir le concept…",
              onChange: (val) => setGroupDefinition(container, id, val),
            }}
          />
        );
      })}
    </div>
  );
}

/* ---------- export du tool ---------- */

export default {
  id: "concept",
  label: "Concept",
  icon: "◯",
  description: "Entoure un mot pour en faire un concept clé",
  tag: "concept",
  mode: "point",
  order: 20,
  snap: snapOnWord,

  ToolbarWidget,

  ghost() {
    const span = document.createElement("span");
    span.className = "explication-concept-ghost";
    span.textContent = "◯";
    return span;
  },

  onDrop({ range, container, helpers }) {
    Group.placeNewGroup(range, container, helpers, (c, i) => wireGroup(c, i, helpers));
  },

  hydrate(container, helpers) {
    Group.hydrateGroups(container, (c, id) => wireGroup(c, id, helpers));
  },

  // Aperçu de survol pendant le drag depuis la barre
  PreviewMarker({ rect }) {
    return (
      <div
        className="explication-concept-preview"
        style={{ "--top": `${rect.top}px`, "--left": `${rect.left}px`, "--width": `${rect.width}px`, "--height": `${rect.height}px` }}
      />
    );
  },

  getBadge,
  PanelContent,
};