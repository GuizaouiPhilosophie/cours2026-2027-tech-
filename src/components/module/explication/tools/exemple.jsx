/**
 * Outil Exemple : fonctionne comme Concept (voir concept.jsx) — toute la
 * mécanique générique (contour SVG en escalier, poignées gauche/droite,
 * re-saisie du corps entier, découpage d'un Range en segments par bloc
 * <p>...) vit dans lib/groupOverlay.js. Ce qui reste ici est propre à
 * Exemple :
 *
 * - la forme du <exemple> lui-même (champ "description", pas
 *   "definition"),
 * - le contour en pointillé et la teinte verte (voir exemple.css),
 *   contrairement au contour plein de Concept,
 * - le titre affiché dans la card du panneau : "premier_mot [...]
 *   dernier_mot" (ou juste "mot" si l'exemple ne fait qu'un seul mot),
 *   calculé à la volée à partir du texte actuel du premier et du dernier
 *   segment du groupe — pas besoin de le stocker en attribut, il reste
 *   juste même après un import ou un redimensionnement. Concept, lui, se
 *   contente du titre générique (formatGroupTitle de groupOverlay.js) ;
 *   Exemple garde sa propre version car un exemple est souvent plus long
 *   qu'un concept et le titre doit rester court dans la card.
 * - le widget de la barre d'outils et le panneau du bas.
 */

import { snapOnWordWithPunctuation, snapOnWordTolerant, makeId } from "../lib/grab";
import { createGroupOverlay } from "../lib/groupOverlay";
import { usePanelList } from "../lib/panelList";
import ExplicationCard from "../ExplicationCard";
import "./exemple.css";

const isTouchDevice = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

/* ---------- forme du <exemple> ---------- */

function makeExempleEl(id, description) {
  const el = document.createElement("exemple");
  el.className = "explication-exemple";
  el.dataset.id = id || makeId("exemple");
  if (description) el.setAttribute("description", description);
  return el;
}

function getDescription(el) {
  return el?.getAttribute("description") || "";
}

function setGroupDescription(container, id, value) {
  Group.segmentsOf(container, id).forEach((el) => el.setAttribute("description", value));
}

const Group = createGroupOverlay({
  tag: "exemple",
  snap: snapOnWordTolerant,
  createElement: makeExempleEl,
  getPayload: getDescription,
  ghostChar: "▭",
});

/* ---------- titre de la card : "premier_mot [...] dernier_mot" ---------- */

// Un dernier "mot" qui n'est QUE de la ponctuation de fin (cas de la
// typo française : espace insécable avant ?!;:) n'a pas de sens affiché
// seul — on le rattache au mot qui le précède.
const PURE_TRAILING_PUNCT_RE = /^[.,;:!?…»”’)\]}]+$/;

function splitWords(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function edgeWord(text, fromStart) {
  const words = splitWords(text);
  if (!words.length) return "";
  if (fromStart) return words[0];
  const last = words[words.length - 1];
  if (words.length > 1 && PURE_TRAILING_PUNCT_RE.test(last)) return words[words.length - 2] + last;
  return last;
}

// Calculé à la volée depuis le premier et le dernier segment du groupe —
// pas besoin de le stocker, ça reste juste même après un import ou un
// redimensionnement.
function formatExempleTitle(segs) {
  if (!segs.length) return "";
  const first = edgeWord(segs[0].textContent, true);
  const last = edgeWord(segs[segs.length - 1].textContent, false);
  if (!first) return "";
  return first === last ? first : `${first} [...] ${last}`;
}

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
      helpers.openPanel?.("exemple", id);
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
      if (e.relatedTarget?.closest?.(".explication-exemple-handle")) return;
      if (e.relatedTarget?.closest?.(`exemple[data-id="${id}"]`)) return;
      Group.clearHandles(container);
    });
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!consumeClick()) helpers.openPanel?.("exemple", id);
    });
  }
}

function wireGroup(container, id, helpers) {
  Group.segmentsOf(container, id).forEach((el) => wireSegment(el, id, container, helpers));
}

/* ---------- barre d'outils ---------- */

function ToolbarWidget({ startDrag }) {
  return (
    <div className="explication-exemple-widget">
      <span className="explication-exemple-widget-label">Exemple</span>
      <div className="explication-exemple-chip" onPointerDown={startDrag({})} title="Entourer un exemple">
        ▭
      </div>
    </div>
  );
}

/* ---------- liste des exemples, badge, panneau ---------- */

function getBadge(container) {
  const items = Group.listGroups(container);
  return items.length ? { label: "Exemples", count: items.length } : null;
}

// Titre non éditable (la portion de texte couverte, lue depuis le DOM) ;
// seule la description est un champ, répliquée sur tous les segments du
// groupe.
function PanelContent({ containerRef, version, helpers, bounceTarget }) {
  const container = containerRef.current;
  const items = container ? Group.listGroups(container) : [];
  const { order, byId, bouncingId, startCardDrag, setCardRef } = usePanelList({
    items,
    toolId: "exemple",
    version,
    bounceTarget,
    onDelete(id) {
      Group.removeGroup(container, id, helpers);
    },
  });

  if (order.length === 0) return <p className="explication-panel-empty">Aucun exemple pour l’instant.</p>;

  return (
    <div className="explication-panel-list">
      {order.map((id) => {
        const it = byId.get(id);
        if (!it || !container) return null;
        return (
          <ExplicationCard
            key={id}
            cardRef={setCardRef(id)}
            className="explication-card--exemple"
            accentColor="#3a7d68"
            width="10rem"
            bouncing={bouncingId === id}
            onGripPointerDown={startCardDrag(id)}
            title={{ value: formatExempleTitle(it.segs), editable: false }}
            description={{
              value: getDescription(it.segs[0]),
              placeholder: "Décrire l’exemple…",
              onChange: (val) => setGroupDescription(container, id, val),
            }}
          />
        );
      })}
    </div>
  );
}

/* ---------- export du tool ---------- */

export default {
  id: "exemple",
  label: "Exemple",
  icon: "▭",
  description: "Entoure un passage (un mot, une phrase, plusieurs lignes) pour en faire un exemple.",
  tag: "exemple",
  mode: "point",
  order: 30,
  snap: snapOnWordWithPunctuation,

  ToolbarWidget,

  ghost() {
    const span = document.createElement("span");
    span.className = "explication-exemple-ghost";
    span.textContent = "▭";
    return span;
  },

  onDrop({ range, container, helpers }) {
    Group.placeNewGroup(range, container, helpers, (c, i) => wireGroup(c, i, helpers));
  },

  hydrate(container, helpers) {
    Group.hydrateGroups(container, (c, id) => wireGroup(c, id, helpers));
  },

  // Aperçu de survol pendant le drag depuis la barre (pointillé vert translucide)
  PreviewMarker({ rect }) {
    return (
      <div
        className="explication-exemple-preview"
        style={{ "--top": `${rect.top}px`, "--left": `${rect.left}px`, "--width": `${rect.width}px`, "--height": `${rect.height}px` }}
      />
    );
  },

  getBadge,
  PanelContent,
};