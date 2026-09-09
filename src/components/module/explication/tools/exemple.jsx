/**
 * Outil Exemple — fonctionne comme Concept (voir concept.jsx) sur les
 * points communs : dépôt sur un mot depuis la barre d'outils, panneau du
 * bas avec une card par instance, double-clic pour supprimer (le texte
 * redevient normal). Deux différences propres à Exemple :
 *
 * - le contour est en pointillé (voir exemple.css) et, au lieu des
 *   boutons +/- de Concept, deux POIGNÉES apparaissent aux bords gauche
 *   et droit qu'on peut directement glisser pour étendre/rétrécir la
 *   sélection mot par mot — comme une poignée de sélection de texte
 *   classique. Contrairement à Concept, un Exemple peut donc couvrir
 *   plusieurs lignes (paragraphes) d'un coup.
 * - pas de reprise en main du bloc entier (pas de "regrab" du corps pour
 *   le redéposer ailleurs) : ça n'a pas grand sens pour un passage qui
 *   peut faire plusieurs lignes. Cliquer sur le corps ouvre simplement
 *   le panneau ; seules les poignées sont saisissables.
 *
 * ---------- un exemple = un GROUPE de segments ----------
 * Un exemple peut couvrir plusieurs blocs de premier niveau (des <p>).
 * On ne peut pas se contenter d'un seul <exemple> englobant tout : le
 * Range traverserait alors plusieurs <p>, et surroundContents()/
 * extractContents() finit par couper un <p> en deux et imbriquer des
 * <p> à l'intérieur d'un <exemple> — structure invalide qui casse
 * l'affichage.
 *
 * On procède donc exactement comme une sélection de texte native, et
 * comme le fait Mouvement pour ses paires de crochets : le Range est
 * découpé en un segment PAR <p> traversé (voir wrapAcrossBlocks), et
 * chaque segment reçoit son propre <exemple>, tous partageant le même
 * `data-id`. Un exemple d'une seule ligne n'est jamais qu'un groupe à
 * un seul segment ; le reste du fichier (hover, poignées, suppression,
 * panneau) raisonne toujours en termes de groupe (voir segmentsOf),
 * jamais d'un unique élément DOM.
 *
 * Le titre affiché dans la card ("premier_mot [...] dernier_mot", ou
 * juste "mot" si l'exemple ne fait qu'un seul mot) est calculé à la
 * volée à partir du texte actuel du premier et du dernier segment du
 * groupe — pas besoin de le stocker en attribut, il reste juste même
 * après un import ou un redimensionnement.
 */

import { snapOnWordWithPunctuation, snapOnWordTolerant, makeId, startGrab } from "../lib/grab";
import { usePanelList } from "../lib/panelList";
import ExplicationCard from "../ExplicationCard";
import "./exemple.css";

const isTouchDevice = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

/* ---------- bloc de premier niveau (pour le découpage multi-<p>) ---------- */

// Bloc de premier niveau sous `container` (typiquement un <p>) qui
// contient `node`, ou null si `node` n'est pas dans `container`.
function topBlockOf(container, node) {
  let top = node;
  while (top && top.parentNode && top.parentNode !== container) top = top.parentNode;
  if (!top || top.parentNode !== container) return null;
  return top;
}

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

// Calculé à la volée depuis le premier et le dernier segment du groupe,
// comme l'était l'ancien "ligne X à Y" — pas besoin de le stocker, ça
// reste juste même après un import ou un redimensionnement.
function formatGroupTitle(segs) {
  if (!segs.length) return "";
  const first = edgeWord(segs[0].textContent, true);
  const last = edgeWord(segs[segs.length - 1].textContent, false);
  if (!first) return "";
  return first === last ? first : `${first} [...] ${last}`;
}

/* ---------- création / wrap / unwrap d'UN segment ---------- */

function makeExemple(id, description) {
  const el = document.createElement("exemple");
  el.className = "explication-exemple";
  el.dataset.id = id || makeId("exemple");
  if (description) el.setAttribute("description", description);
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

function unwrapExemple(el) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
  parent.normalize();
}

/* ---------- le GROUPE (tous les segments qui partagent un data-id) ---------- */

function segmentsOf(container, id) {
  return Array.from(container.querySelectorAll(`exemple[data-id="${id}"]`));
}

function unwrapGroup(container, id) {
  segmentsOf(container, id).forEach(unwrapExemple);
}

function setGroupDescription(container, id, value) {
  segmentsOf(container, id).forEach((el) => el.setAttribute("description", value));
}

/**
 * Découpe `range` en un segment par bloc de premier niveau traversé, et
 * pose un <exemple> par segment (tous avec le même `id`) — jamais un
 * seul <exemple> à cheval sur plusieurs <p>. Chaque segment reste born
 * é à l'intérieur de son <p> d'origine, donc surroundContents() y
 * réussit toujours : aucune balise de bloc n'est jamais coupée.
 *
 * - même bloc des deux côtés : un seul segment (cas historique, un mot
 *   ou une phrase sur une ligne).
 * - blocs différents : un segment "début" (du point de départ jusqu'à
 *   la fin de son <p>), un segment par bloc entièrement couvert entre
 *   les deux, un segment "fin" (du début de son <p> jusqu'au point
 *   d'arrivée) — comme une sélection de texte qui traverse des lignes.
 *
 * Retourne la liste des segments créés.
 */
function wrapAcrossBlocks(range, container, id, description) {
  const startBlock = topBlockOf(container, range.startContainer);
  const endBlock = topBlockOf(container, range.endContainer);

  if (!startBlock || !endBlock || startBlock === endBlock) {
    const el = makeExemple(id, description);
    wrap(range, el);
    return [el];
  }

  const blocks = Array.from(container.children);
  const startIdx = blocks.indexOf(startBlock);
  const endIdx = blocks.indexOf(endBlock);
  const segments = [];

  const startRange = document.createRange();
  startRange.setStart(range.startContainer, range.startOffset);
  startRange.setEnd(startBlock, startBlock.childNodes.length);
  const startEl = makeExemple(id, description);
  wrap(startRange, startEl);
  segments.push(startEl);

  for (let i = startIdx + 1; i < endIdx; i += 1) {
    const full = document.createRange();
    full.selectNodeContents(blocks[i]);
    const el = makeExemple(id, description);
    wrap(full, el);
    segments.push(el);
  }

  const endRange = document.createRange();
  endRange.setStart(endBlock, 0);
  endRange.setEnd(range.endContainer, range.endOffset);
  const endEl = makeExemple(id, description);
  wrap(endRange, endEl);
  segments.push(endEl);

  return segments;
}

/* ---------- combiner deux points DOM en un Range ordonné ---------- */
// Nécessaire pour le redimensionnement : on connaît un point fixe (le
// bord qui ne bouge pas) et un point mobile (sous la souris), sans savoir
// a priori lequel des deux vient en premier dans le document — glisser
// une poignée au-delà de l'autre doit d'ailleurs pouvoir "retourner" la
// sélection, comme une sélection de texte classique.
function comparePoints(a, b) {
  const ra = document.createRange();
  ra.setStart(a.node, a.offset);
  const rb = document.createRange();
  rb.setStart(b.node, b.offset);
  return ra.compareBoundaryPoints(Range.START_TO_START, rb);
}

function rangeBetween(a, b) {
  const [start, end] = comparePoints(a, b) <= 0 ? [a, b] : [b, a];
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

/* ---------- contour unifié en escalier (une seule forme, même sur
   plusieurs lignes/paragraphes — comme le surlignage natif d'une
   sélection de texte multi-lignes) ---------- */

const OUTLINE_RADIUS = 4; // même rayon que .explication-exemple / les autres formes de l'outil

function svgEl(tag) {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

// Arrondit chaque coin d'un polygone (points reliés par des segments
// horizontaux/verticaux uniquement) en un petit arc, via une courbe
// quadratique dont le point de contrôle est le coin d'origine. Le rayon
// effectif est plafonné à la moitié de chaque segment adjacent, pour ne
// jamais "manger" un segment plus court que le rayon.
function pointsToRoundedPath(points, radius) {
  const n = points.length;
  if (n < 3) return "";

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const insetToward = (from, to, r) => {
    const d = dist(from, to);
    return d === 0 ? from : lerp(from, to, Math.min(r, d / 2) / d);
  };

  const at = (i) => points[((i % n) + n) % n];
  const corners = [];
  for (let i = 0; i < n; i += 1) {
    const curr = at(i);
    corners.push({
      in: insetToward(curr, at(i - 1), radius),
      corner: curr,
      out: insetToward(curr, at(i + 1), radius),
    });
  }

  const fmt = (p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  const d = [`M ${fmt(corners[0].out)}`];
  for (let i = 1; i <= n; i += 1) {
    const c = corners[i % n];
    d.push(`L ${fmt(c.in)}`, `Q ${fmt(c.corner)} ${fmt(c.out)}`);
  }
  d.push("Z");
  return d.join(" ");
}

// Points du bord DROIT, du haut vers le bas : descend la ligne courante,
// puis — si la ligne suivante n'a pas le même bord droit (largeur
// différente) — fait un palier HORIZONTAL au niveau du bas de la ligne
// courante avant de redescendre à la VERTICALE sur le nouveau bord.
// Jamais de saut direct en diagonale d'un coin à l'autre.
function rightEdgePoints(lines) {
  const pts = [];
  lines.forEach((ln, i) => {
    if (i > 0) {
      const prev = lines[i - 1];
      if (prev.right !== ln.right) pts.push({ x: ln.right, y: prev.bottom }); // palier horizontal
    }
    pts.push({ x: ln.right, y: ln.top });
    pts.push({ x: ln.right, y: ln.bottom });
  });
  return pts;
}

// Symétrique de rightEdgePoints, bord GAUCHE, du bas vers le haut (pour
// refermer le polygone en repartant de la fin du bord droit).
function leftEdgePoints(lines) {
  const pts = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const ln = lines[i];
    if (i < lines.length - 1) {
      const next = lines[i + 1];
      if (next.left !== ln.left) pts.push({ x: ln.left, y: next.top }); // palier horizontal
    }
    pts.push({ x: ln.left, y: ln.bottom });
    pts.push({ x: ln.left, y: ln.top });
  }
  return pts;
}

// Construit le tracé "en escalier" d'un ensemble de rects (un par ligne
// visuelle, dans l'ordre du texte) : longe le bord droit ligne par
// ligne (avec un palier horizontal, jamais une diagonale, à chaque
// changement de largeur), puis remonte le long du bord gauche —
// exactement le contour qu'affiche un navigateur pour une sélection de
// texte étendue sur plusieurs lignes.
function buildStaircasePath(rects, stageBox, radius = OUTLINE_RADIUS) {
  if (!rects.length) return "";
  const lines = Array.from(rects).map((rc) => ({
    top: rc.top - stageBox.top,
    left: rc.left - stageBox.left,
    right: rc.right - stageBox.left,
    bottom: rc.bottom - stageBox.top,
  }));

  return pointsToRoundedPath([...rightEdgePoints(lines), ...leftEdgePoints(lines)], radius);
}

// Contour "posé" d'un groupe (état de repos, toujours visible — c'est
// lui qui remplace l'ancienne bordure CSS par-segment). Recalculé à
// chaque fois que la composition ou la mise en page du groupe peut avoir
// changé (création, redimensionnement, resize fenêtre...), jamais géré
// en CSS pur puisqu'un seul <path> doit courir sur plusieurs éléments.
function clearGroupOutline(container, id) {
  container.parentElement?.querySelector(`.explication-exemple-outline[data-outline-id="${id}"]`)?.remove();
}

function renderGroupOutline(container, id) {
  const segs = segmentsOf(container, id);
  const stage = container.parentElement;
  if (!segs.length || !stage) return clearGroupOutline(container, id);

  const rects = segs.flatMap((el) => Array.from(el.getClientRects()));
  if (!rects.length) return clearGroupOutline(container, id);

  const stageBox = stage.getBoundingClientRect();
  const d = buildStaircasePath(rects, stageBox);

  let svg = stage.querySelector(`.explication-exemple-outline[data-outline-id="${id}"]`);
  if (!svg) {
    svg = svgEl("svg");
    svg.classList.add("explication-exemple-outline");
    svg.dataset.outlineId = id;
    svg.appendChild(svgEl("path"));
    stage.appendChild(svg);
  }
  svg.querySelector("path").setAttribute("d", d);
}

// Recalcule le contour de tous les groupes du container, et nettoie au
// passage ceux dont le groupe a disparu par un autre chemin que
// unwrapGroup/clearGroupOutline (garde-fou).
function renderAllOutlines(container) {
  const stage = container.parentElement;
  const currentIds = new Set(Array.from(container.querySelectorAll("exemple")).map((el) => el.dataset.id));
  stage?.querySelectorAll(".explication-exemple-outline[data-outline-id]").forEach((svg) => {
    if (!currentIds.has(svg.dataset.outlineId)) svg.remove();
  });
  currentIds.forEach((id) => renderGroupOutline(container, id));
}

/* ---------- aperçu pendant le redimensionnement ---------- */
// Même mécanique que renderGroupOutline (un contour en escalier unique),
// mais transitoire : suit le Range candidat sous la souris pendant
// qu'on tire une poignée, avant confirmation au lâcher.

function clearRangePreview(container) {
  container.parentElement?.querySelectorAll(".explication-exemple-drag-preview").forEach((p) => p.remove());
}

function showRangePreview(container, range) {
  clearRangePreview(container);
  const stage = container.parentElement;
  if (!stage) return;
  const rects = Array.from(range.getClientRects());
  if (!rects.length) return;

  const stageBox = stage.getBoundingClientRect();
  const d = buildStaircasePath(rects, stageBox);

  const svg = svgEl("svg");
  svg.classList.add("explication-exemple-outline", "explication-exemple-outline--preview", "explication-exemple-drag-preview");
  const path = svgEl("path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  stage.appendChild(svg);
}

/* ---------- poignées gauche/droite ---------- */

function clearHandles(node) {
  const stage = node?.classList?.contains("explication-canvas-stage") ? node : node?.parentElement;
  stage?.querySelectorAll(".explication-exemple-handle").forEach((h) => h.remove());
}

function onOutsideTap(e) {
  if (e.target.closest(".explication-exemple-handle") || e.target.closest(".explication-exemple")) return;
  document.querySelectorAll(".explication-canvas-stage").forEach(clearHandles);
  document.removeEventListener("pointerdown", onOutsideTap, true);
}

// Glisser une poignée : le bord opposé reste fixe (anchor = début du
// premier segment du groupe, ou fin du dernier), l'autre suit le mot
// survolé (snapOnWord) et peut traverser des <p> entiers — le Range
// obtenu est alors redécoupé en segments par wrapAcrossBlocks, pas
// posé tel quel dans un unique <exemple>.
//
// Passe par startGrab (lib/grab.js) comme tous les autres grabs de
// l'app : détection de la poubelle (onDelete), nettoyage sur
// pointercancel, fantôme cohérent avec le reste des outils.
function startEdgeDrag(id, side, container, helpers) {
  return (e) => {
    e.preventDefault();
    e.stopPropagation();

    const segs = segmentsOf(container, id);
    if (!segs.length) return;
    const first = segs[0];
    const last = segs[segs.length - 1];

    // Ancre exprimée dans le PARENT (à l'index de first/last), pas dans
    // l'élément <exemple> lui-même : celui-ci est retiré du DOM au drop
    // (unwrapGroup), et un point de Range ancré directement sur un nœud
    // supprimé se recale automatiquement sur sa position au moment de la
    // suppression — qui tombe après le mot (le texte est ressorti avant
    // l'élément juste avant sa suppression). Un point ancré dans le
    // parent, lui, reste stable de part et d'autre de cette mutation.
    const anchor =
      side === "right"
        ? { node: first.parentNode, offset: Array.prototype.indexOf.call(first.parentNode.childNodes, first) }
        : { node: last.parentNode, offset: Array.prototype.indexOf.call(last.parentNode.childNodes, last) + 1 };

    function resolve(_container, x, y) {
      // Tolérant (voir lib/grab.js) : absorbe le tremblement de la main
      // et l'imprécision du geste de dépôt — espace entre deux mots,
      // interligne entre deux lignes... Le mot visé reste toujours
      // capturé en entier, avec sa ponctuation finale (., ,, …,
      // guillemet/parenthèse fermants) : un Exemple est souvent une
      // phrase, pas juste un mot.
      const found = snapOnWordTolerant(_container, x, y);
      if (!found) return null;
      const point =
        side === "right"
          ? { node: found.range.endContainer, offset: found.range.endOffset }
          : { node: found.range.startContainer, offset: found.range.startOffset };
      const candidate = rangeBetween(anchor, point);
      if (!candidate.toString().trim()) return null; // jamais de sélection vide
      return { range: candidate, kind: "word" };
    }

    const ghost = document.createElement("span");
    ghost.className = "explication-exemple-ghost";
    ghost.textContent = side === "right" ? "→" : "←";

    startGrab({
      container,
      resolve,
      ghostContent: ghost,
      event: e,
      onPreview(result) {
        if (result) showRangePreview(container, result.range);
        else clearRangePreview(container);
      },
      onDrop({ range: candidate }) {
        clearHandles(container);
        const description = first.getAttribute("description") || "";
        unwrapGroup(container, id);
        wrapAcrossBlocks(candidate, container, id, description);
        wireGroup(container, id, helpers);
        renderGroupOutline(container, id);
        helpers.bump();
      },
      onCancel() {
        // Dépôt hors zone (ou sélection vide) : l'exemple garde ses bornes d'origine.
        clearHandles(container);
      },
      onDelete() {
        // Lâché sur la poubelle : dé-envelopper tout le groupe, comme le double-clic.
        clearHandles(container);
        unwrapGroup(container, id);
        clearGroupOutline(container, id);
        helpers.bump();
      },
    });
  };
}

// Poignées positionnées sur le bord GAUCHE du premier segment et le
// bord DROIT du dernier — c'est-à-dire les deux extrémités visuelles
// du groupe entier, quel que soit le nombre de lignes couvertes.
function attachHandlesForGroup(id, container, helpers) {
  clearHandles(container);
  const segs = segmentsOf(container, id);
  if (!segs.length) return;
  const first = segs[0];
  const last = segs[segs.length - 1];
  const firstRects = first.getClientRects();
  const lastRects = last.getClientRects();
  if (!firstRects.length || !lastRects.length) return;

  const stageBox = container.parentElement.getBoundingClientRect();
  const edges = [
    ["left", firstRects[0]],
    ["right", lastRects[lastRects.length - 1]],
  ];

  edges.forEach(([side, rect]) => {
    const h = document.createElement("div");
    h.className = `explication-exemple-handle explication-exemple-handle--${side}`;
    const x = side === "left" ? rect.left - stageBox.left : rect.right - stageBox.left;
    h.style.setProperty("--handle-left", `${x}px`);
    h.style.setProperty("--handle-top", `${rect.top - stageBox.top + rect.height / 2}px`);
    h.addEventListener("pointerdown", startEdgeDrag(id, side, container, helpers));
    // Repartir vers n'importe quel segment du groupe, ou vers l'autre
    // poignée, ne doit pas faire disparaître celle-ci (même logique
    // que le garde sur les segments eux-mêmes, voir wireSegment).
    h.addEventListener("mouseleave", (e) => {
      if (e.relatedTarget?.closest?.(".explication-exemple-handle")) return;
      if (segs.some((s) => s === e.relatedTarget || s.contains?.(e.relatedTarget))) return;
      clearHandles(container);
    });
    container.parentElement.appendChild(h);
  });
}

/* ---------- câblage d'un segment / d'un groupe ---------- */

function wireSegment(el, id, container, helpers) {
  if (el.dataset.wired === "1") return;
  el.dataset.wired = "1";

  if (isTouchDevice()) {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      attachHandlesForGroup(id, container, helpers);
      document.addEventListener("pointerdown", onOutsideTap, true);
      helpers.openPanel?.("exemple", id);
    });
  } else {
    el.addEventListener("mouseenter", () => attachHandlesForGroup(id, container, helpers));
    // Les poignées sont centrées sur le bord du groupe, donc à moitié
    // À L'INTÉRIEUR du segment extrême — sans ce garde, viser la
    // poignée déclenche le mouseleave du segment (qui devient
    // l'élément survolé) et la supprime avant même le pointerdown de
    // saisie. On ignore aussi le passage vers un autre segment du même
    // groupe (lignes adjacentes d'un exemple multi-lignes).
    el.addEventListener("mouseleave", (e) => {
      if (e.relatedTarget?.closest?.(".explication-exemple-handle")) return;
      if (e.relatedTarget?.closest?.(`exemple[data-id="${id}"]`)) return;
      clearHandles(container);
    });
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      helpers.openPanel?.("exemple", id);
    });
  }
}

function wireGroup(container, id, helpers) {
  segmentsOf(container, id).forEach((el) => wireSegment(el, id, container, helpers));
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

/* ---------- liste, badge, panneau ---------- */

// Un item par GROUPE (data-id), pas par élément DOM : un exemple
// multi-lignes a plusieurs <exemple> mais une seule card dans le panneau.
function getExemples(container) {
  const groups = new Map();
  container.querySelectorAll("exemple").forEach((el) => {
    const id = el.dataset.id;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(el);
  });
  return Array.from(groups.entries()).map(([id, segs]) => ({ id, segs }));
}

function getBadge(container) {
  const items = getExemples(container);
  return items.length ? { label: "Exemples", count: items.length } : null;
}

// Titre non éditable : la ou les lignes couvertes, calculées à la volée
// depuis la position actuelle du premier et du dernier segment du
// groupe. Seule la description est un champ, répliquée sur tous les
// segments du groupe pour rester lisible quel que soit le segment lu.
function PanelContent({ containerRef, version, helpers, bounceTarget }) {
  const container = containerRef.current;
  const items = container ? getExemples(container) : [];
  const { order, byId, bouncingId, startCardDrag, setCardRef } = usePanelList({
    items,
    toolId: "exemple",
    version,
    bounceTarget,
    onDelete(id) {
      unwrapGroup(container, id);
      clearGroupOutline(container, id);
      helpers.bump();
    },
  });

  if (order.length === 0) return <p className="explication-panel-empty">Aucun exemple pour l’instant.</p>;

  return (
    <div className="explication-panel-list">
      {order.map((id) => {
        const it = byId.get(id);
        if (!it || !container) return null;
        const title = formatGroupTitle(it.segs);
        const description = it.segs[0]?.getAttribute("description") || "";

        return (
          <ExplicationCard
            key={id}
            cardRef={setCardRef(id)}
            className="explication-card--exemple"
            accentColor="#3a7d68"
            width="10rem"
            bouncing={bouncingId === id}
            onGripPointerDown={startCardDrag(id)}
            title={{ value: title, editable: false }}
            description={{
              value: description,
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
    // pas d'imbrication : mot déjà dans un <exemple> -> ignoré
    let node = range.startContainer;
    while (node && node !== container) {
      if (node.nodeType === 1 && node.tagName === "EXEMPLE") return;
      node = node.parentNode;
    }
    // garde-fou mobile : Range vide/espace près d'une frontière de mot
    if (!range.toString().trim()) return;

    // Premier dépôt depuis la barre : toujours un seul mot, donc un seul
    // bloc traversé — wrapAcrossBlocks se comporte ici comme l'ancien
    // wrap() simple, mais on passe par le même chemin que le
    // redimensionnement pour n'avoir qu'une seule logique de création.
    const id = makeId("exemple");
    wrapAcrossBlocks(range, container, id);
    wireGroup(container, id, helpers);
    renderGroupOutline(container, id);
    helpers.bump();
  },

  hydrate(container, helpers) {
    // Regroupe les <exemple> importés par data-id (un import généré par
    // cet outil peut déjà contenir plusieurs segments d'un même groupe) ;
    // un élément sans id (balisage écrit à la main) en reçoit un neuf et
    // forme son propre groupe à un seul segment.
    const groups = new Map();
    container.querySelectorAll("exemple").forEach((el) => {
      el.classList.add("explication-exemple");
      if (!el.dataset.id) el.dataset.id = makeId("exemple");
      const id = el.dataset.id;
      if (!groups.has(id)) groups.set(id, true);
    });
    groups.forEach((_, id) => wireGroup(container, id, helpers));
    renderAllOutlines(container);

    // La mise en page (largeur des lignes, retours à la ligne) peut
    // changer sans qu'aucune de nos actions ne s'en charge (resize de la
    // fenêtre) : un seul listener par container suffit, il recalcule
    // tous les groupes d'un coup.
    if (!container.dataset.exempleResizeWired) {
      container.dataset.exempleResizeWired = "1";
      window.addEventListener("resize", () => renderAllOutlines(container));
    }
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