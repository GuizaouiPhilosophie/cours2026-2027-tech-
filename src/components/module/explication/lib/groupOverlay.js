/**
 * Mécanique générique d'un "groupe redimensionnable" posé dans le texte :
 * un ou plusieurs segments (même balise, même data-id) qui partagent
 * - un contour SVG unifié en escalier (un seul <path>, jamais une bordure
 *   CSS par segment — voir buildStaircasePath),
 * - deux poignées gauche/droite pour étendre/rétrécir mot par mot,
 * - une re-saisie du corps entier pour le redéposer ailleurs en gardant
 *   son nombre de mots.
 *
 * Extrait de concept.jsx, dont c'était à l'origine la moitié du fichier :
 * rien ici ne dépend de ce qu'est un "concept" (ni de sa définition, ni
 * de son panneau), seulement de sa balise et de ses classes CSS — d'où
 * la config passée à createGroupOverlay. Pensé pour être repris tel quel
 * par un futur outil du même genre (Exemple...), même si pour l'instant
 * Concept est le seul appelant.
 *
 * Usage (voir concept.jsx) :
 *   const Group = createGroupOverlay({ tag: "concept", snap, createElement, getPayload });
 *   Group.placeNewGroup(range, container, helpers, onWired);
 */

import { makeId, startGrab, wordSpanRange, rangeOverlapsOtherGroup } from "./grab";

function splitWords(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

/* ---------- bloc de premier niveau (pour le découpage multi-<p>) ---------- */

function topBlockOf(container, node) {
  let top = node;
  while (top && top.parentNode && top.parentNode !== container) top = top.parentNode;
  if (!top || top.parentNode !== container) return null;
  return top;
}

/* ---------- wrap bas niveau ---------- */

function wrap(range, el) {
  try {
    range.surroundContents(el);
  } catch {
    el.appendChild(range.extractContents());
    range.insertNode(el);
  }
}

/* ---------- combiner deux points DOM en un Range ordonné ---------- */

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

/* ---------- Range <-> offsets de texte (immunisés au démantèlement) ---------- */
// unwrapGroup mute le DOM (déplace des nœuds, supprime les wrappers,
// normalize()) : un Range natif traversant un segment en train d'être
// démantelé peut voir ses bornes se comporter de façon imprévisible
// d'un navigateur à l'autre. Les offsets de texte (mesurés sur le texte
// concaténé de `container`), eux, ne bougent pas — unwrap ne change
// jamais le texte, seulement les balises autour. On "photographie" donc
// une position en offset avant de démanteler, puis on la reconvertit en
// Range une fois le DOM stabilisé.

function textOffsetOf(container, node, offset) {
  const r = document.createRange();
  r.selectNodeContents(container);
  r.setEnd(node, offset);
  return r.toString().length;
}

function rangeFromTextOffsets(container, start, end) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let startPoint = null;
  let endPoint = null;
  let cur = walker.nextNode();
  while (cur && (!startPoint || !endPoint)) {
    const len = cur.nodeValue.length;
    if (!startPoint && pos + len >= start) startPoint = { node: cur, offset: start - pos };
    if (!endPoint && pos + len >= end) endPoint = { node: cur, offset: end - pos };
    pos += len;
    cur = walker.nextNode();
  }
  if (!startPoint || !endPoint) return null;
  const range = document.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  return range;
}

/* ---------- géométrie du contour en escalier ---------- */

const OUTLINE_RADIUS = 4;

function svgEl(tag) {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

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

function rightEdgePoints(lines) {
  const pts = [];
  lines.forEach((ln, i) => {
    if (i > 0) {
      const prev = lines[i - 1];
      if (prev.right !== ln.right) pts.push({ x: ln.right, y: prev.bottom });
    }
    pts.push({ x: ln.right, y: ln.top });
    pts.push({ x: ln.right, y: ln.bottom });
  });
  return pts;
}

function leftEdgePoints(lines) {
  const pts = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const ln = lines[i];
    if (i < lines.length - 1) {
      const next = lines[i + 1];
      if (next.left !== ln.left) pts.push({ x: ln.left, y: next.top });
    }
    pts.push({ x: ln.left, y: ln.bottom });
    pts.push({ x: ln.left, y: ln.top });
  }
  return pts;
}

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

const GRAB_THRESHOLD = 6;

// Option "appui tenu" pour distinguer un scroll d'une saisie du corps
// entier (voir wireBodyGrab) : on n'intercepte le geste tactile qu'après
// GRAB_HOLD_MS sans que le doigt se soit assez éloigné (SCROLL_CANCEL_PX)
// — un scroll normal s'écarte tout de suite du point de contact, une
// saisie volontaire, elle, commence par un appui à peu près immobile.
const GRAB_HOLD_MS = 200;
const SCROLL_CANCEL_PX = 10;

/**
 * @param {string} tag            nom de la balise custom (ex. "concept"), en minuscule
 * @param {Function} snap         stratégie de snap (container, x, y) => {range, kind} | null,
 *                                 utilisée par les poignées et la re-saisie du corps
 * @param {Function} createElement (id, payload) => HTMLElement — fabrique un segment neuf
 * @param {Function} getPayload   (segmentEl) => payload — relit ce qu'un segment porte
 *                                 (ex. la définition d'un concept), pour le faire suivre
 *                                 lors d'un redécoupage (poignée, re-saisie du corps)
 * @param {string} [ghostChar]    caractère affiché sous le curseur pendant la re-saisie
 *                                 du corps entier (les poignées utilisent toujours → / ←)
 */
export function createGroupOverlay({ tag, snap, createElement, getPayload, ghostChar = "" }) {
  const TAG = tag.toUpperCase();
  const prefix = `explication-${tag}`;
  const outlineClass = `${prefix}-outline`;
  const previewClass = `${outlineClass}--preview`;
  const dragPreviewClass = `${prefix}-drag-preview`;
  const handleClass = `${prefix}-handle`;
  const draggingClass = `${prefix}--dragging`;
  const ghostClass = `${prefix}-ghost`;
  const calloutClass = `${prefix}-callout`;

  // Vrai tant qu'un drag (poignée OU corps entier) est en cours. Empêche
  // attachHandlesForGroup de se redéclencher en plein milieu (typiquement
  // au passage de la souris sur le corps du groupe pendant un
  // rétrécissement) et de détruire la poignée qu'on est en train de
  // tenir — voir le commentaire sur attachHandlesForGroup plus bas.
  let dragActive = false;

  /* ---------- le groupe (tous les segments qui partagent un data-id) ---------- */

  function segmentsOf(container, id) {
    return Array.from(container.querySelectorAll(`${tag}[data-id="${id}"]`));
  }

  function unwrapOne(el) {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    parent.normalize();
  }

  function unwrapGroup(container, id) {
    segmentsOf(container, id).forEach(unwrapOne);
  }

  function listGroups(container) {
    const groups = new Map();
    container.querySelectorAll(tag).forEach((el) => {
      const id = el.dataset.id;
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(el);
    });
    return Array.from(groups.entries()).map(([id, segs]) => ({ id, segs }));
  }

  /**
   * Découpe `range` en un segment par bloc de premier niveau traversé, et
   * pose un segment par bloc (même `id`) — jamais un seul élément à
   * cheval sur plusieurs <p>.
   */
  function wrapAcrossBlocks(range, container, id, payload) {
    const startBlock = topBlockOf(container, range.startContainer);
    const endBlock = topBlockOf(container, range.endContainer);

    if (!startBlock || !endBlock || startBlock === endBlock) {
      const el = createElement(id, payload);
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
    const startEl = createElement(id, payload);
    wrap(startRange, startEl);
    segments.push(startEl);

    for (let i = startIdx + 1; i < endIdx; i += 1) {
      const full = document.createRange();
      full.selectNodeContents(blocks[i]);
      const el = createElement(id, payload);
      wrap(full, el);
      segments.push(el);
    }

    const endRange = document.createRange();
    endRange.setStart(endBlock, 0);
    endRange.setEnd(range.endContainer, range.endOffset);
    const endEl = createElement(id, payload);
    wrap(endRange, endEl);
    segments.push(endEl);

    return segments;
  }

  /* ---------- contour unifié + aperçu ---------- */

  function clearGroupOutline(container, id) {
    container.parentElement?.querySelector(`.${outlineClass}[data-outline-id="${id}"]`)?.remove();
  }

  function renderGroupOutline(container, id) {
    const segs = segmentsOf(container, id);
    const stage = container.parentElement;
    if (!segs.length || !stage) return clearGroupOutline(container, id);

    const rects = segs.flatMap((el) => Array.from(el.getClientRects()));
    if (!rects.length) return clearGroupOutline(container, id);

    const stageBox = stage.getBoundingClientRect();
    const d = buildStaircasePath(rects, stageBox);

    let svg = stage.querySelector(`.${outlineClass}[data-outline-id="${id}"]`);
    if (!svg) {
      svg = svgEl("svg");
      svg.classList.add(outlineClass);
      svg.dataset.outlineId = id;
      svg.appendChild(svgEl("path"));
      stage.appendChild(svg);
    }
    svg.querySelector("path").setAttribute("d", d);
  }

  function renderAllOutlines(container) {
    const stage = container.parentElement;
    const currentIds = new Set(Array.from(container.querySelectorAll(tag)).map((el) => el.dataset.id));
    stage?.querySelectorAll(`.${outlineClass}[data-outline-id]`).forEach((svg) => {
      if (!currentIds.has(svg.dataset.outlineId)) svg.remove();
    });
    currentIds.forEach((id) => renderGroupOutline(container, id));
  }

  function clearRangePreview(container) {
    container.parentElement?.querySelectorAll(`.${dragPreviewClass}`).forEach((p) => p.remove());
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
    svg.classList.add(outlineClass, previewClass, dragPreviewClass);
    const path = svgEl("path");
    path.setAttribute("d", d);
    svg.appendChild(path);
    stage.appendChild(svg);
  }

  // Bulle qui suit le doigt pendant un drag (poignée ou re-saisie du
  // corps), décalée au-dessus du point de contact : sur tactile, le
  // doigt cache justement l'endroit qu'on est en train de viser, cette
  // bulle affiche donc ce que le doigt masque (le mot actuellement
  // ciblé). Positionnée en coordonnées écran (clientX/clientY) converties
  // en repère local à `stage`, comme le reste des overlays.
  function clearDragCallout(container) {
    container.parentElement?.querySelector(`.${calloutClass}`)?.remove();
  }

  const CALLOUT_HIGHLIGHT_WORDS = 2;

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Pour une poignée, le texte complet du candidat n'est pas ce qui
  // intéresse : ce qui compte, c'est où se trouve le bord qu'on est en
  // train de bouger — l'autre bord peut être arbitrairement loin (tout
  // le début/fin du groupe). On ne garde donc que les derniers mots côté
  // droit (respectivement les premiers côté gauche), avec les 2 mots au
  // bord même mis en évidence (<mark>), et un "…" côté tronqué s'il reste
  // du texte au-delà.
  function buildEdgeCalloutMarkup(text, side) {
    const words = splitWords(text);
    if (!words.length) return "";
    const n = Math.min(CALLOUT_HIGHLIGHT_WORDS, words.length);

    if (side === "right") {
      const tail = words.slice(-n);
      const hasMore = words.length > n;
      return `${hasMore ? "… " : ""}<mark>${escapeHtml(tail.join(" "))}</mark>`;
    }

    const head = words.slice(0, n);
    const hasMore = words.length > n;
    return `<mark>${escapeHtml(head.join(" "))}</mark>${hasMore ? " …" : ""}`;
  }

  function showDragCallout(container, content, clientX, clientY, { html = false } = {}) {
    const stage = container.parentElement;
    if (!stage) return;
    let bubble = stage.querySelector(`.${calloutClass}`);
    if (!bubble) {
      bubble = document.createElement("div");
      bubble.className = calloutClass;
      stage.appendChild(bubble);
    }
    if (html) bubble.innerHTML = content;
    else bubble.textContent = content;
    const stageBox = stage.getBoundingClientRect();
    bubble.style.setProperty("--callout-left", `${clientX - stageBox.left}px`);
    bubble.style.setProperty("--callout-top", `${clientY - stageBox.top}px`);
  }

  function wireOutlineResize(container) {
    const key = `${tag}ResizeWired`;
    if (container.dataset[key]) return;
    container.dataset[key] = "1";
    window.addEventListener("resize", () => renderAllOutlines(container));
  }

  /* ---------- poignées gauche/droite (extension/rétraction) ---------- */

  function clearHandles(node) {
    const stage = node?.classList?.contains("explication-canvas-stage") ? node : node?.parentElement;
    stage?.querySelectorAll(`.${handleClass}`).forEach((h) => h.remove());
  }

  // Écouteur global (capture) : un tap/clic hors poignée et hors du
  // groupe referme les poignées ouvertes. Une seule instance par tool
  // (voir concept.jsx), posée/retirée à la demande.
  function onOutsideTap(e) {
    if (e.target.closest(`.${handleClass}`) || e.target.closest(`.${prefix}`)) return;
    document.querySelectorAll(".explication-canvas-stage").forEach(clearHandles);
    document.removeEventListener("pointerdown", onOutsideTap, true);
  }

  // Glisser une poignée : le bord opposé reste fixe, l'autre suit le mot
  // survolé (`snap`, tolérant au tremblement de la main). Le Range obtenu
  // est redécoupé en segments par wrapAcrossBlocks.
  function startEdgeDrag(id, side, container, helpers, onWired) {
    return (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragActive = true;

      const segs = segmentsOf(container, id);
      if (!segs.length) return;
      const first = segs[0];
      const last = segs[segs.length - 1];

      // Ancre dans le PARENT (pas dans le segment lui-même, retiré du DOM
      // au drop).
      const anchor =
        side === "right"
          ? { node: first.parentNode, offset: Array.prototype.indexOf.call(first.parentNode.childNodes, first) }
          : { node: last.parentNode, offset: Array.prototype.indexOf.call(last.parentNode.childNodes, last) + 1 };

      function resolve(_container, x, y) {
        const found = snap(_container, x, y);
        if (!found) return null;
        const point =
          side === "right"
            ? { node: found.range.endContainer, offset: found.range.endOffset }
            : { node: found.range.startContainer, offset: found.range.startOffset };
        const candidate = rangeBetween(anchor, point);
        if (!candidate.toString().trim()) return null;
        if (rangeOverlapsOtherGroup(candidate, TAG, id)) return null;
        return { range: candidate, kind: "word" };
      }

      const ghost = document.createElement("span");
      ghost.className = ghostClass;
      ghost.textContent = side === "right" ? "→" : "←";

      startGrab({
        container,
        resolve,
        ghostContent: ghost,
        event: e,
        onPreview(result, ev) {
          if (result) {
            showRangePreview(container, result.range);
            const markup = buildEdgeCalloutMarkup(result.range.toString(), side);
            showDragCallout(container, markup, ev.clientX, ev.clientY, { html: true });
          } else {
            clearRangePreview(container);
            clearDragCallout(container);
          }
        },
        onDrop({ range: candidate }) {
          dragActive = false;
          clearHandles(container);
          regroup(container, id, candidate, helpers, onWired);
        },
        onCancel() {
          dragActive = false;
          clearHandles(container);
        },
        onDelete() {
          dragActive = false;
          clearHandles(container);
          removeGroup(container, id, helpers);
        },
      });
    };
  }

  // Poignées sur le bord GAUCHE du premier segment et le bord DROIT du
  // dernier — les deux extrémités visuelles du groupe entier.
  function attachHandlesForGroup(id, container, helpers, onWired) {
    console.log("[debug concept] attachHandlesForGroup", { id, dragActive });
    // Ne rien reconstruire pendant un drag déjà en cours : rétrécir via
    // une poignée oblige la souris à repasser au-dessus du corps du
    // groupe pour viser le mot restant (contrairement à l'extension, où
    // elle s'en éloigne toujours) — sans ce garde-fou, le survol du
    // corps déclenchait un nouvel appel ici, qui détruisait (clearHandles)
    // la poignée qu'on était justement en train de tenir.
    if (dragActive) {
      console.log("[debug concept] attachHandlesForGroup: bloqué par dragActive");
      return;
    }

    clearHandles(container);
    const segs = segmentsOf(container, id);
    if (!segs.length) {
      console.log("[debug concept] attachHandlesForGroup: aucun segment trouvé pour", id);
      return;
    }
    const first = segs[0];
    const last = segs[segs.length - 1];
    const firstRects = first.getClientRects();
    const lastRects = last.getClientRects();
    if (!firstRects.length || !lastRects.length) {
      console.log("[debug concept] attachHandlesForGroup: rects vides", {
        firstRects: firstRects.length,
        lastRects: lastRects.length,
      });
      return;
    }
    console.log("[debug concept] attachHandlesForGroup: pose des poignées", { firstRect: firstRects[0], lastRect: lastRects[lastRects.length - 1] });

    const stageBox = container.parentElement.getBoundingClientRect();
    const edges = [
      ["left", firstRects[0]],
      ["right", lastRects[lastRects.length - 1]],
    ];

    edges.forEach(([side, rect]) => {
      const h = document.createElement("div");
      h.className = `${handleClass} ${handleClass}--${side}`;
      const x = side === "left" ? rect.left - stageBox.left : rect.right - stageBox.left;
      h.style.setProperty("--handle-left", `${x}px`);
      h.style.setProperty("--handle-top", `${rect.top - stageBox.top + rect.height / 2}px`);
      h.addEventListener("pointerdown", startEdgeDrag(id, side, container, helpers, onWired));
      h.addEventListener("mouseleave", (ev) => {
        if (ev.relatedTarget?.closest?.(`.${handleClass}`)) return;
        if (segs.some((s) => s === ev.relatedTarget || s.contains?.(ev.relatedTarget))) return;
        clearHandles(container);
      });
      container.parentElement.appendChild(h);
    });
  }

  /* ---------- re-saisie du corps entier (le déplacer ailleurs) ---------- */
  // Contrairement aux poignées (qui bougent UN bord), re-saisir n'importe
  // quel segment du groupe l'emporte tout entier : au lâcher, il se
  // redépose ailleurs en conservant son nombre de mots (wordSpanRange),
  // pas juste son premier mot.
  // `onTap` (optionnel) : appelé au relâcher si le pointeur n'a jamais
  // dépassé GRAB_THRESHOLD, càd un tap/clic simple plutôt qu'un drag.
  // Indispensable sur tactile : le touchmove ci-dessous appelle
  // preventDefault() une fois le geste armé (nécessaire pour bloquer le
  // scroll natif pendant le drag), ce qui a pour effet de bord de
  // supprimer les événements souris de compatibilité que le navigateur
  // générerait sinon après le tap — dont "click". Un `click` posé par
  // l'appelant (voir concept.jsx) ne se déclenche donc jamais sur un vrai
  // appareil tactile (seulement en émulation navigateur, qui ne
  // reproduit pas cette suppression) ; `onTap` est le seul moyen fiable
  // d'y détecter un tap simple.
  //
  // Sur tactile, on ne bloque PAS le scroll dès le premier contact :
  // .explication-concept/-exemple sont posés au milieu d'un texte
  // scrollable, et un touchstart y intercepterait n'importe quel geste
  // de défilement qui démarre sur un mot annoté. On attend donc un appui
  // tenu GRAB_HOLD_MS sans que le doigt ne s'écarte de plus de
  // SCROLL_CANCEL_PX avant d'armer la capture ; si le doigt s'éloigne
  // avant, c'est un scroll — on n'appelle jamais preventDefault et on
  // laisse le navigateur faire son travail. Ce n'est qu'une fois armé
  // que le touchmove suivant bloque le scroll et laisse le pointermove
  // ci-dessous prendre le relais du geste. Revers de la médaille : un
  // appui tenu parfaitement immobile plus longtemps que le seuil natif
  // (~500ms) peut encore déclencher le menu contextuel de sélection
  // iOS avant que ce délai n'arme quoi que ce soit — -webkit-touch-
  // callout: none (voir le CSS) reste la protection principale contre ça.
  function wireBodyGrab(el, id, container, helpers, onWired, onTap) {
    el.addEventListener(
      "touchstart",
      (e) => {
        if (e.target.closest(`.${handleClass}`)) return;
        if (e.touches.length !== 1) return;

        const touch = e.touches[0];
        const startX = touch.clientX, startY = touch.clientY;
        let armed = false;
        let settled = false;

        const armTimer = setTimeout(() => {
          armed = true;
        }, GRAB_HOLD_MS);

        function onTouchMove(ev) {
          if (settled) return;
          const t = ev.touches[0];
          if (!t) return;
          if (!armed) {
            // Pas encore armé : le doigt s'est déjà assez éloigné pour
            // que ce soit clairement un scroll, pas une saisie -> on
            // abandonne définitivement pour ce contact, sans jamais
            // avoir touché à preventDefault.
            if (Math.hypot(t.clientX - startX, t.clientY - startY) > SCROLL_CANCEL_PX) settle();
            return;
          }
          // Armé : on bloque le scroll natif à partir d'ici : le
          // pointermove posé par pointerdown ci-dessous gère la suite
          // du geste (fantôme, seuil GRAB_THRESHOLD, etc.)
          ev.preventDefault();
        }

        function settle() {
          if (settled) return;
          settled = true;
          clearTimeout(armTimer);
          el.removeEventListener("touchmove", onTouchMove);
          el.removeEventListener("touchend", settle);
          el.removeEventListener("touchcancel", settle);
        }

        el.addEventListener("touchmove", onTouchMove, { passive: false });
        el.addEventListener("touchend", settle);
        el.addEventListener("touchcancel", settle);
      },
      { passive: true }
    );

    el.addEventListener("pointerdown", (e) => {
      if (e.target.closest(`.${handleClass}`)) return;
      e.preventDefault();

      const startX = e.clientX, startY = e.clientY;
      let started = false;

      function onMove(ev) {
        if (started || Math.hypot(ev.clientX - startX, ev.clientY - startY) < GRAB_THRESHOLD) return;
        started = true;
        dragActive = true;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        const segs = segmentsOf(container, id);
        if (!segs.length) return;
        el.dataset.justDragged = "1";
        clearHandles(container);

        const wordCount = splitWords(segs.map((s) => s.textContent).join(" ")).length;
        const payload = getPayload(segs[0]);

        segs.forEach((s) => s.classList.add(draggingClass));
        clearGroupOutline(container, id);
        const restore = () => {
          segs.forEach((s) => s.classList.remove(draggingClass));
          renderGroupOutline(container, id);
        };

        const ghost = document.createElement("span");
        ghost.className = ghostClass;
        ghost.textContent = ghostChar;

        function resolve(_container, x, y) {
          const found = snap(_container, x, y);
          if (!found) return null;
          const candidate = wordSpanRange(_container, found.range.startContainer, found.range.startOffset, wordCount);
          if (!candidate || !candidate.toString().trim()) return null;
          if (rangeOverlapsOtherGroup(candidate, TAG, id)) return null;
          return { range: candidate, kind: "word" };
        }

        startGrab({
          container,
          resolve,
          ghostContent: ghost,
          event: ev,
          onPreview(result, ev) {
            if (result) {
              showRangePreview(container, result.range);
              showDragCallout(container, result.range.toString(), ev.clientX, ev.clientY);
            } else {
              clearRangePreview(container);
              clearDragCallout(container);
            }
          },
          onDrop({ range: candidate }) {
            dragActive = false;
            clearRangePreview(container);
            regroup(container, id, candidate, helpers, onWired, payload);
          },
          onCancel: () => {
            dragActive = false;
            restore();
          },
          onDelete() {
            dragActive = false;
            clearRangePreview(container);
            removeGroup(container, id, helpers);
          },
        });
      }
      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (!started) onTap?.();
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  /* ---------- opérations de haut niveau (placement / redécoupage / suppression) ---------- */

  // Dépôt initial depuis la barre d'outils : pas d'imbrication (mot déjà
  // dans un segment du même type -> ignoré), Range vide près d'une
  // frontière de mot -> ignoré. Retourne l'id créé, ou null si ignoré.
  function placeNewGroup(range, container, helpers, onWired, payload) {
    let node = range.startContainer;
    while (node && node !== container) {
      if (node.nodeType === 1 && node.tagName === TAG) return null;
      node = node.parentNode;
    }
    if (!range.toString().trim()) return null;

    const id = makeId(tag);
    wrapAcrossBlocks(range, container, id, payload);
    onWired?.(container, id);
    renderGroupOutline(container, id);
    helpers.bump();
    return id;
  }

  // Redécoupe un groupe existant sur un nouveau Range, en conservant son
  // payload (ex. la définition) — utilisé par les poignées et la
  // re-saisie du corps. `payload`, s'il est fourni, évite de le relire
  // sur des segments déjà retirés du DOM par unwrapGroup.
  function regroup(container, id, range, helpers, onWired, payload) {
    const carried = payload !== undefined ? payload : getPayload(segmentsOf(container, id)[0]);

    // `range` peut avoir une borne à l'intérieur même des segments qu'on
    // s'apprête à démanteler (cas d'un rétrécissement : le mot ciblé est
    // dans le groupe). On la fige donc en offsets de texte, immunisés
    // au démantèlement, avant d'appeler unwrapGroup — sinon ses bornes
    // peuvent se retrouver n'importe où (voire collapser) une fois le
    // DOM remué par unwrap+normalize. Voir textOffsetOf / rangeFromTextOffsets.
    const start = textOffsetOf(container, range.startContainer, range.startOffset);
    const end = textOffsetOf(container, range.endContainer, range.endOffset);

    unwrapGroup(container, id);

    const rebuilt = rangeFromTextOffsets(container, start, end) || range;
    wrapAcrossBlocks(rebuilt, container, id, carried);
    onWired?.(container, id);
    renderGroupOutline(container, id);
    helpers.bump();
  }

  function removeGroup(container, id, helpers) {
    unwrapGroup(container, id);
    clearGroupOutline(container, id);
    helpers.bump();
  }

  // Regroupe les segments importés par data-id, leur assigne un id s'il
  // manque, et (re)dessine tous les contours. `onWired(container, id)`
  // est appelé une fois par groupe pour que l'appelant câble ses propres
  // écouteurs (clic, hover...).
  function hydrateGroups(container, onWired) {
    const groups = new Map();
    container.querySelectorAll(tag).forEach((el) => {
      el.classList.add(prefix);
      if (!el.dataset.id) el.dataset.id = makeId(tag);
      groups.set(el.dataset.id, true);
    });
    groups.forEach((_, id) => onWired?.(container, id));
    renderAllOutlines(container);
    wireOutlineResize(container);
  }

  return {
    segmentsOf,
    listGroups,
    placeNewGroup,
    regroup,
    removeGroup,
    hydrateGroups,
    attachHandlesForGroup,
    clearHandles,
    onOutsideTap,
    wireBodyGrab,
  };
}

// Titre affiché pour un groupe : son texte actuel (un mot, ou une courte
// suite de mots après extension). Calculé à la volée — pas besoin de le
// stocker, ça reste juste après import ou redimensionnement.
export function formatGroupTitle(segs) {
  return segs.map((s) => s.textContent).join(" ").trim();
}