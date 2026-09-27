/**
 * Mécanique tap-à-tap (mobile), généralisée à partir de tools/mouvement.jsx.
 *
 */

import { TRASH_SELECTOR } from "./grab";

export const isTouchDevice = () =>
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

// Un tap "compte" si le doigt n'a quasi pas bougé entre l'appui et le
// relâchement — sinon c'est un scroll/glissement, pas un tap de
// placement. On se fie à pointerdown/pointerup plutôt qu'à "click" :
// plus direct, sans dépendre de sa synthèse (délai, annulation sur léger
// mouvement...) propre à chaque navigateur mobile.
const TAP_THRESHOLD = 10;
export function isTap(start, e) {
  return !!start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < TAP_THRESHOLD;
}

/**
 * Colle un suivi pointerdown/pointerup à `el` et appelle `onTap(e)` quand
 * le relâchement constitue un vrai tap (voir isTap). Petite factorisation
 * du pattern répété par chaque source tap-armable (chip, objet posé dans
 * le texte, poubelle...) : évite à chaque outil de reporter à la main un
 * `tapStart` par élément.
 */
export function trackTap(el, onTap) {
  let start = null;
  el.addEventListener("pointerdown", (e) => {
    start = { x: e.clientX, y: e.clientY };
  });
  el.addEventListener("pointerup", (e) => {
    const s = start;
    start = null;
    if (isTap(s, e)) onTap(e);
  });
}

// Marque un élément comme source d'armement (chip de la barre, objet posé
// dans le texte...) : exclu du "tap ailleurs annule" global, puisque
// c'est lui-même qui gère son armement/désarmement à son propre tap. Sans
// ce marquage, le pointerdown de ce tap serait lui-même intercepté par le
// listener global (posé en phase de capture, donc AVANT le pointerup de
// l'élément) et désarmerait juste avant que l'élément n'ait eu la chance
// de réagir — cassant en particulier "retaper l'objet déjà armé annule".
export function markTapSource(el) {
  if (el) el.dataset.tapSource = "1";
}

/* ---------- état "armé", partagé par toute l'app ---------- */

let armed = null;
const armedListeners = new Set();

function notify() {
  armedListeners.forEach((fn) => fn(armed));
}

export function getArmed() {
  return armed;
}

// Pour qu'un chip React reflète l'armement en cours — y compris déclenché
// depuis ailleurs (un marqueur du texte, la poubelle...) — il s'abonne
// ici ; `fn` est appelée immédiatement avec l'état courant, puis à chaque
// changement. Retourne la fonction de désabonnement (utilisable
// directement comme cleanup d'un useEffect).
export function subscribeArmed(fn) {
  armedListeners.add(fn);
  fn(armed);
  return () => armedListeners.delete(fn);
}

export function disarm() {
  if (!armed) return;
  armed.onArmChange?.(false);
  armed = null;
  notify();
}

export function armToPlace(spec) {
  disarm();
  armed = spec;
  spec.onArmChange?.(true);
  notify();
}

// Retaper l'objet déjà armé annule — comportement commun à toutes les
// sources tap-armables (chip neuf ou objet déjà posé) : à utiliser à la
// place d'armToPlace directement dans le handler de tap d'une source.
export function toggleArm(spec) {
  if (armed && armed.toolId === spec.toolId && armed.key === spec.key) {
    disarm();
  } else {
    armToPlace(spec);
  }
}

/* ---------- second tap : dépôt dans le texte ---------- */

const CANVAS_SELECTOR = ".explication-canvas";

/**
 * Câble le second tap sur `container` : sans effet si déjà câblé (peut
 * donc être appelé depuis le `hydrate` de chaque outil sans coordination
 * entre eux — un seul listener réel est posé, quel que soit le nombre
 * d'outils qui appellent cette fonction sur le même container). N'agit
 * que si un objet est actuellement armé POUR CE container
 * (`armed.container === container`) — peu importe quel outil l'a armé,
 * c'est `armed.resolve`/`armed.place`, fournis par cet outil au moment de
 * l'armement, qui décident de tout ici.
 */
export function wireTapCanvas(container, helpers) {
  if (container.dataset.tapCanvasWired === "1") return;
  container.dataset.tapCanvasWired = "1";

  let start = null;
  container.addEventListener("pointerdown", (e) => {
    start = { x: e.clientX, y: e.clientY };
  });
  container.addEventListener("pointerup", (e) => {
    const s = start;
    start = null;
    if (!isTap(s, e)) return;
    if (!armed || armed.container !== container) return;
    // Un tap sur l'objet armé lui-même (en cours de redéplacement) ne
    // doit pas se déposer sur lui-même : c'est son propre tap-source
    // (markTapSource, via trackTap côté outil) qui gère ce cas — retaper
    // l'objet armé l'annule, via toggleArm.
    if (armed.el && (e.target === armed.el || armed.el.contains?.(e.target))) return;

    const found = armed.resolve(container, e.clientX, e.clientY);
    if (!found) return;
    e.preventDefault();
    const spec = armed;
    disarm();
    spec.place(found.range, helpers);
  });
}

/**
 * Câble le tap sur la poubelle : une seule fois pour toute l'app (la
 * poubelle est unique dans la barre d'outils, voir ExplicationEditor.jsx
 * et TRASH_SELECTOR dans lib/grab.js). Idempotent — chaque outil peut
 * l'appeler depuis son `hydrate` sans se soucier des autres.
 */
let trashWired = false;
export function wireTapTrash(helpers) {
  if (trashWired) return;
  const trash = document.querySelector(TRASH_SELECTOR);
  if (!trash) return;
  trashWired = true;
  trackTap(trash, () => {
    if (!armed) return;
    const spec = armed;
    disarm();
    if (spec.el) spec.onTrash?.(helpers);
  });
}

/**
 * Tap n'importe où ailleurs (hors source armable marquée, hors canvas,
 * hors poubelle) annule le placement en cours. Auto-installée une seule
 * fois au chargement de ce module (voir l'appel en bas de fichier) : un
 * outil qui importe tapPlace.js n'a rien de plus à faire pour en
 * bénéficier.
 */
let outsideCancellerInstalled = false;
export function installOutsideTapCanceller() {
  if (outsideCancellerInstalled || typeof document === "undefined") return;
  outsideCancellerInstalled = true;
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!armed) return;
      if (e.target.closest("[data-tap-source]")) return;
      if (e.target.closest(CANVAS_SELECTOR)) return;
      if (e.target.closest(TRASH_SELECTOR)) return;
      disarm();
    },
    true
  );
}

installOutsideTapCanceller();