/**
 * Outil Concept : dépose un <concept> autour d'UN mot entier.
 * - survol pendant le drag : pointillé rouge translucide
 * - déposé : contour rouge plein
 * - boutons "+" à gauche/droite pour étendre au mot voisin (hover desktop, tap mobile)
 * - double-clic (ou lâcher sur la poubelle) : dé-enveloppe le mot
 * La mécanique générique de prise en main vient de ../lib/grab.js, celle
 * du panneau du bas de ../lib/panelList.js.
 */

import { snapOnWord, startGrab, makeId } from "../lib/grab";
import { usePanelList } from "../lib/panelList";
import ExplicationCard from "../ExplicationCard";
import "./concept.css";

const WORD_RE = /[A-Za-zÀ-ÖØ-öø-ÿ0-9œŒæÆ'’-]/;
const isWordChar = (c) => c && WORD_RE.test(c);
const isTouchDevice = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

/* ---------- utilitaires texte ---------- */

// Étend un <concept> existant en absorbant le mot voisin (side: "left"/"right").
function extendConcept(el, side) {
  const parent = el.parentNode;
  if (!parent) return;

  if (side === "right") {
    let node = el.nextSibling;
    while (node && node.nodeType === Node.TEXT_NODE && !/\S/.test(node.nodeValue)) node = node.nextSibling;
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const text = node.nodeValue;
    let i = 0;
    while (i < text.length && !isWordChar(text[i])) i += 1;
    if (i >= text.length) return;
    let j = i;
    while (j < text.length && isWordChar(text[j])) j += 1;

    const before = text.slice(0, i), word = text.slice(i, j), after = text.slice(j);
    if (before) node.parentNode.insertBefore(document.createTextNode(before), node);
    el.appendChild(document.createTextNode((el.textContent.endsWith(" ") ? "" : " ") + word));
    node.nodeValue = after;
    if (!after) node.parentNode.removeChild(node);
  } else {
    let node = el.previousSibling;
    while (node && node.nodeType === Node.TEXT_NODE && !/\S/.test(node.nodeValue)) node = node.previousSibling;
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const text = node.nodeValue;
    let j = text.length;
    while (j > 0 && !isWordChar(text[j - 1])) j -= 1;
    if (j <= 0) return;
    let i = j;
    while (i > 0 && isWordChar(text[i - 1])) i -= 1;

    const before = text.slice(0, i), word = text.slice(i, j), after = text.slice(j);
    el.insertBefore(document.createTextNode(word + (el.textContent.startsWith(" ") ? "" : " ")), el.firstChild);
    node.nodeValue = before;
    if (!before) node.parentNode.removeChild(node);
    if (after) node.parentNode.insertBefore(document.createTextNode(after), node.nextSibling);
  }
  parent.normalize();
}

function makeConcept(id, definition) {
  const el = document.createElement("concept");
  el.className = "explication-concept";
  el.dataset.id = id || makeId("concept");
  if (definition) el.setAttribute("definition", definition);
  return el;
}

function wrap(range, el) {
  try {
    range.surroundContents(el);
  } catch {
    el.appendChild(range.extractContents());
    range.insertNode(el);
  }
}

function unwrapConcept(el) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
  parent.normalize();
}

/* ---------- boutons +/- d'extension ---------- */

function clearHoverButtons(node) {
  const stage = node?.classList?.contains("explication-canvas-stage") ? node : node?.parentElement;
  stage?.querySelectorAll(".explication-concept-btn").forEach((b) => b.remove());
}

function attachButtons(el, container, helpers, mode) {
  clearHoverButtons(container);
  const rect = el.getBoundingClientRect();
  const stageBox = container.parentElement.getBoundingClientRect();

  const makeBtn = (side) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `explication-concept-btn explication-concept-btn--${side}`;
    btn.textContent = "+";
    // Le centre du bouton tombe pile sur la bordure gauche/droite du contour.
    const edgeX = side === "left" ? rect.left - stageBox.left : rect.right - stageBox.left;
    btn.style.setProperty("--btn-left", `${edgeX}px`);
    btn.style.setProperty("--btn-top", `${rect.top - stageBox.top + rect.height / 2}px`);
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      extendConcept(el, side);
      clearHoverButtons(container);
      helpers.bump();
    });
    return btn;
  };

  container.parentElement.appendChild(makeBtn("left"));
  container.parentElement.appendChild(makeBtn("right"));
}

function onOutsideTap(e) {
  if (e.target.closest(".explication-concept-btn") || e.target.closest(".explication-concept")) return;
  document.querySelectorAll(".explication-canvas-stage").forEach(clearHoverButtons);
  document.removeEventListener("pointerdown", onOutsideTap, true);
}

/* ---------- pointillé de survol pendant la reprise en main (DOM pur) ---------- */

function clearDragPreview(container) {
  container.parentElement?.querySelectorAll(".explication-concept-drag-preview").forEach((p) => p.remove());
}

function showDragPreview(container, result) {
  clearDragPreview(container);
  if (!result) return;
  const stage = container.parentElement;
  const stageBox = stage.getBoundingClientRect();
  const rect = result.range.getBoundingClientRect();
  const preview = document.createElement("div");
  preview.className = "explication-concept-preview explication-concept-drag-preview";
  preview.style.setProperty("--top", `${rect.top - stageBox.top}px`);
  preview.style.setProperty("--left", `${rect.left - stageBox.left}px`);
  preview.style.setProperty("--width", `${rect.width}px`);
  preview.style.setProperty("--height", `${rect.height}px`);
  stage.appendChild(preview);
}

/* ---------- reprise en main d'un concept déjà posé ---------- */

// Seuil avant de considérer un pointerdown comme un vrai geste de saisie
// (sinon un simple clic déclencherait un drag). Reprendre un concept ne
// "emporte" pas le mot : ça retire juste le contour et repasse en mode
// dépôt-sur-un-mot (snapOnWord), comme le premier glisser depuis la barre.
const GRAB_THRESHOLD = 6;

function wireConceptGrab(el, container, helpers) {
  // Sur tactile, la loupe de sélection native se déclenche avant notre
  // seuil : on la coupe dès le touchstart, uniquement sur le concept.
  el.addEventListener("touchstart", (e) => !e.target.closest(".explication-concept-btn") && e.preventDefault(), { passive: false });

  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".explication-concept-btn")) return;
    e.preventDefault(); // sinon le navigateur démarre sa propre sélection de texte

    const startX = e.clientX, startY = e.clientY;
    let started = false;

    function onMove(ev) {
      if (started || Math.hypot(ev.clientX - startX, ev.clientY - startY) < GRAB_THRESHOLD) return;
      started = true;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      el.dataset.justDragged = "1"; // annule le clic/tap qui suivrait sinon
      clearHoverButtons(container);
      el.classList.add("explication-concept--dragging");

      const ghost = document.createElement("span");
      ghost.className = "explication-concept-ghost";
      ghost.textContent = "◯";
      const restore = () => el.classList.remove("explication-concept--dragging");

      startGrab({
        container,
        resolve: snapOnWord,
        ghostContent: ghost,
        event: ev,
        onPreview: (result) => showDragPreview(container, result),
        onDrop({ range }) {
          // pas de dépôt dans un AUTRE concept ; sur le mot d'origine, on laisse retomber
          let node = range.startContainer;
          while (node && node !== container) {
            if (node.nodeType === 1 && node.tagName === "CONCEPT" && node !== el) return restore();
            node = node.parentNode;
          }
          // Garde-fou tactile : dépôt trop proche de l'origine -> Range vide après normalize()
          if (!range.toString().trim()) return restore();

          const definition = el.getAttribute("definition") || "";
          const id = el.dataset.id;
          unwrapConcept(el);
          const newEl = makeConcept(id, definition);
          wrap(range, newEl);
          wireConceptEl(newEl, container, helpers);
          helpers.bump();
        },
        onCancel: restore, // hors zone valide : reprend sa place d'origine
        onDelete() {
          // "supprimer" un concept ne supprime pas le mot, juste l'enveloppe
          unwrapConcept(el);
          helpers.bump();
        },
      });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

function wireConceptEl(el, container, helpers) {
  if (el.dataset.wired === "1") return;
  el.dataset.wired = "1";
  wireConceptGrab(el, container, helpers);

  // Un clic qui était en fait le seuil de départ d'un drag ne doit pas
  // en plus ouvrir le panneau / les boutons.
  const consumeClick = () => {
    if (el.dataset.justDragged !== "1") return false;
    delete el.dataset.justDragged;
    return true;
  };

  if (isTouchDevice()) {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (consumeClick()) return;
      attachButtons(el, container, helpers, "tap");
      document.addEventListener("pointerdown", onOutsideTap, true);
      helpers.openPanel?.("concept", el.dataset.id);
    });
  } else {
    el.addEventListener("mouseenter", () => el.dataset.justDragged !== "1" && attachButtons(el, container, helpers, "hover"));
    el.addEventListener("mouseleave", () => clearHoverButtons(container));
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!consumeClick()) helpers.openPanel?.("concept", el.dataset.id);
    });
  }
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

function getConcepts(container) {
  return Array.from(container.querySelectorAll("concept")).map((el) => ({ id: el.dataset.id, el }));
}

function getBadge(container) {
  const items = getConcepts(container);
  return items.length ? { label: "Concepts", count: items.length } : null;
}

// Titre non éditable (c'est le mot lui-même, lu depuis le DOM) ; seule la
// description ("définition") est un champ, stocké dans l'attribut `definition`.
function PanelContent({ containerRef, version, helpers, bounceTarget }) {
  const container = containerRef.current;
  const items = container ? getConcepts(container) : [];
  const { order, byId, bouncingId, startCardDrag, setCardRef } = usePanelList({
    items,
    toolId: "concept",
    version,
    bounceTarget,
    onDelete(id) {
      const it = items.find((x) => x.id === id);
      if (it) unwrapConcept(it.el);
      helpers.bump();
    },
  });

  if (order.length === 0) return <p className="explication-panel-empty">Aucun concept pour l’instant.</p>;

  return (
    <div className="explication-panel-list">
      {order.map((id) => {
        const it = byId.get(id);
        if (!it) return null;
        return (
          <ExplicationCard
            key={id}
            cardRef={setCardRef(id)}
            className="explication-card--concept"
            accentColor="#c1694c"
            width="9rem"
            bouncing={bouncingId === id}
            onGripPointerDown={startCardDrag(id)}
            title={{ value: it.el.textContent, editable: false }}
            description={{
              value: it.el.getAttribute("definition") || "",
              placeholder: "Définir le concept…",
              onChange: (val) => it.el.setAttribute("definition", val),
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
    // pas d'imbrication : mot déjà dans un <concept> -> ignoré
    let node = range.startContainer;
    while (node && node !== container) {
      if (node.nodeType === 1 && node.tagName === "CONCEPT") return;
      node = node.parentNode;
    }
    // garde-fou mobile : Range vide/espace près d'une frontière de mot
    if (!range.toString().trim()) return;

    const el = makeConcept();
    wrap(range, el);
    wireConceptEl(el, container, helpers);
    helpers.bump();
  },

  hydrate(container, helpers) {
    container.querySelectorAll("concept").forEach((el) => {
      el.classList.add("explication-concept");
      if (!el.dataset.id) el.dataset.id = makeId("concept");
      wireConceptEl(el, container, helpers);
    });
  },

  // Aperçu de survol pendant le drag depuis la barre (pointillé rouge translucide)
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