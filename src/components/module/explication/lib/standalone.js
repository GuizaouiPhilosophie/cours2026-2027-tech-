/**
 * Sauvegarde / chargement d'un texte annoté sous forme d'un unique
 * fichier .html autonome.
 *
 * Le fichier exporté contient deux choses :
 *  - la donnée canonique : le HTML brut annoté (mêmes balises que ce que
 *    hydrate() sait relire), gardée verbatim dans un
 *    <script type="text/plain" id="explication-source"> caché — c'est
 *    ce qu'extractRawHtml() relit pour reprendre l'édition ;
 *  - un rendu visible en lecture seule de la même annotation (contours
 *    et traits redessinés par un petit script vanilla inliné), avec un
 *    clic sur un concept/exemple/mouvement pour afficher sa
 *    définition/description/label dans une bulle.
 *
 * Le script inliné n'est PAS une réécriture à la main de la géométrie
 * déjà écrite dans lib/overlayGeometry.js : buildInlineScript()
 * embarque le CODE SOURCE réel de ces fonctions (via Function.toString,
 * voir sourceOf ci-dessous) et n'écrit lui-même que la partie qui n'a
 * pas d'équivalent ailleurs (mesure du DOM en lecture seule, rendu des
 * <svg>, bulle au clic) — une seule implémentation de la géométrie,
 * jamais un second texte qui pourrait diverger du premier.
 *
 * Les classes CSS réutilisées (.explication-canvas-wrap/-stage/-canvas,
 * .explication-concept, .explication-exemple, .explication-mouvement-*)
 * sont celles d'explication.css/concept.css/exemple.css/mouvement.css,
 * trimées des parties propres à l'édition (poignées, curseurs grab,
 * chips de la barre, panneau du bas).
 */

import {
  pointsToRoundedPath,
  rightEdgePoints,
  leftEdgePoints,
  buildStaircasePath,
  allMarkers,
  getPairs,
  assignLanes,
} from "./overlayGeometry";

const VOID_TAGS = ["crochetouvert", "crochetferme"];

// Un <crochetouvert>...</crochetouvert> vide sérialise en
// <crochetouvert></crochetouvert> (innerHTML du DOM) ; on le referme en
// balise auto-fermante, comme le faisait l'ancien selfClose() de
// ExplicationEditor.jsx.
export function selfCloseVoidTags(html) {
  return VOID_TAGS.reduce(
    (acc, tag) => acc.replace(new RegExp(`<${tag}([^>]*)>\\s*</${tag}>`, "gi"), `<${tag}$1/>`),
    html
  );
}

// Le HTML brut vit dans un <script type="text/plain"> (jamais exécuté,
// jamais affiché) : la seule chose à éviter est une sous-séquence
// "</script" qui le refermerait prématurément aux yeux du parseur HTML.
function escapeForScriptTag(html) {
  return html.split("</script").join("<\\/script");
}
function unescapeFromScriptTag(text) {
  return text.split("<\\/script").join("</script");
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Code source réel d'une fonction déjà écrite ailleurs (overlayGeometry.js),
// tel quel — PAS une reformulation. `fn.toString()` renvoie exactement le
// texte de la déclaration (sans le mot-clé `export`, qui n'existe plus une
// fois la fonction chargée en mémoire).
function sourceOf(fn) {
  return fn.toString();
}

/* ---------- CSS inliné (repris d'explication.css / concept.css /
   exemple.css / mouvement.css, sans rien de propre à l'édition) ---------- */

function inlineCss() {
  return `
:root {
  --bg: #f7f1ea;
  --bg-card: #fffdfb;
  --border: #e3d7ca;
  --text: #3a2a1d;
  --text-muted: #8a7566;
  --serif: Georgia, "Iowan Old Style", "Palatino Linotype", serif;
  --sans: "Helvetica Neue", Arial, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; padding: 2.5rem 1rem 5rem; background: var(--bg); font-family: var(--sans); color: var(--text); }

.explication-canvas-wrap {
  max-width: 720px;
  margin: 0 auto;
  /* voir le commentaire équivalent dans explication.css : réserve la
     place nécessaire aux traits de Mouvement les plus excentrés. */
  padding-left: var(--mouvement-gutter, 0px);
}
.explication-canvas-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; max-width: 720px; margin: 0 auto 2rem;
}
.explication-canvas-header h1 { font-family: var(--serif); font-size: 1.3rem; margin: 0; color: var(--text); }
.explication-canvas-stage { position: relative; max-width: 720px; margin: 0 auto; }
.explication-canvas {
  position: relative;
  padding: 2rem 2.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  font-family: var(--serif);
  line-height: 1.85;
  color: var(--text);
}
.explication-canvas p { margin: 0 0 1.2rem; text-align: justify; text-justify: inter-word; }
.explication-canvas p:last-child { margin-bottom: 0; }

/* ---- Concept ---- */
.explication-concept {
  padding: 0 2px;
  background: rgba(193, 105, 76, 0.08);
  cursor: pointer;
}
.explication-concept-outline {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  overflow: visible; pointer-events: none;
}
.explication-concept-outline path { fill: none; stroke: #c1694c; stroke-width: 2px; }

/* ---- Exemple ---- */
.explication-exemple {
  padding: 0 2px;
  background: rgba(58, 125, 104, 0.06);
  cursor: pointer;
}
.explication-exemple-outline {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  overflow: visible; pointer-events: none;
}
.explication-exemple-outline path { fill: none; stroke: #3a7d68; stroke-width: 2px; stroke-dasharray: 5 4; }

/* ---- Mouvement ---- */
.explication-mouvement-marker {
  display: inline-block;
  font-family: Georgia, serif;
  font-weight: bold;
  color: var(--marker-color, #664930);
  background: var(--marker-bg, #f2e9de);
  border-radius: 3px;
  padding: 0 2px;
  margin: 0 1px;
  cursor: pointer;
}
.explication-mouvement-overlay { position: absolute; inset: 0; pointer-events: none; }
.explication-mouvement-line-hit {
  position: absolute; top: var(--top); height: var(--height); left: var(--left);
  width: 16px; pointer-events: auto; cursor: pointer;
}
.explication-mouvement-line {
  position: absolute; top: 0; bottom: 0; left: 6.5px; width: 3px;
  background: var(--line-color); border-radius: 3px;
}
.explication-mouvement-dot {
  position: absolute; top: var(--top); left: var(--left);
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--dot-color); box-shadow: 0 0 0 2px var(--bg-card);
}

/* ---- bulle de lecture (clic sur une annotation) ---- */
.xpl-popover {
  position: fixed;
  max-width: min(22rem, 80vw);
  padding: .6rem .8rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(58, 42, 29, .18);
  font-family: var(--sans);
  font-size: .85rem;
  line-height: 1.5;
  color: var(--text);
  z-index: 999;
  display: none;
}
.xpl-popover.is-open { display: block; }
.xpl-popover-label {
  font-weight: 700; font-size: .68rem; text-transform: uppercase;
  letter-spacing: .04em; margin-bottom: .3rem; color: var(--text-muted);
}

@media (max-width: 700px) {
  .explication-canvas-wrap { padding-right: 1rem; padding-left: calc(1rem + var(--mouvement-gutter, 0px)); }
  .explication-canvas { padding: 1rem; font-size: .92rem; line-height: 1.65; }
}
`;
}

/* ---------- script inliné ---------- */
// Les fonctions de géométrie (buildStaircasePath, assignLanes, et leurs
// dépendances) sont injectées telles quelles depuis overlayGeometry.js
// via sourceOf() ci-dessus : ce template ne réécrit QUE la partie
// propre au rendu lecture-seule (mesure DOM, <svg>, bulle), qui n'a pas
// d'équivalent ailleurs (le rendu de l'éditeur est indissociable de sa
// mécanique d'édition — poignées, drag, incrémental par id — inutile
// et inapplicable en lecture seule).
function inlineScript() {
  // Code source réel des fonctions de overlayGeometry.js — aucune
  // n'est réécrite ici, seulement appelée plus bas (avec `canvas` comme
  // `container`, exactement comme groupOverlay.js/mouvement.jsx
  // appellent ces mêmes fonctions avec containerRef.current).
  const geometrySource = [pointsToRoundedPath, rightEdgePoints, leftEdgePoints, buildStaircasePath, allMarkers, getPairs, assignLanes]
    .map(sourceOf)
    .join("\n\n");

  return `
(function () {
  "use strict";
  var stage = document.querySelector(".explication-canvas-stage");
  var canvas = document.querySelector(".explication-canvas");
  var wrap = document.querySelector(".explication-canvas-wrap");
  if (!stage || !canvas) return;

${geometrySource}

  function svgEl(tag) { return document.createElementNS("http://www.w3.org/2000/svg", tag); }

  /* ---- contours Concept / Exemple : mêmes rects+buildStaircasePath
     que renderGroupOutline dans lib/groupOverlay.js, mais en lecture
     seule (pas d'id à effacer/redessiner un par un : tout est reconstruit
     à chaque appel, il n'y a jamais d'édition en cours ici). ---- */
  function renderOutlinesFor(tag) {
    var groups = new Map();
    canvas.querySelectorAll(tag).forEach(function (el) {
      var id = el.dataset.id;
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(el);
    });
    groups.forEach(function (segs) {
      var rects = [];
      segs.forEach(function (el) { rects = rects.concat(Array.prototype.slice.call(el.getClientRects())); });
      if (!rects.length) return;
      var stageBox = stage.getBoundingClientRect();
      var d = buildStaircasePath(rects, stageBox, 4);
      var svg = svgEl("svg");
      svg.setAttribute("class", "explication-" + tag + "-outline");
      var path = svgEl("path");
      path.setAttribute("d", d);
      svg.appendChild(path);
      stage.appendChild(svg);
    });
  }

  function clearOutlines() {
    stage.querySelectorAll(".explication-concept-outline, .explication-exemple-outline").forEach(function (s) { s.remove(); });
  }

  function renderMouvementOverlay() {
    var old = stage.querySelector(".explication-mouvement-overlay");
    if (old) old.remove();

    var laned = assignLanes(getPairs(canvas), allMarkers(canvas));
    var LANE_BASE = 24, LANE_GAP = 28, LINE_WIDTH = 3, HIT_WIDTH = 16, DOT_SIZE = 8;
    var stageBox = stage.getBoundingClientRect();
    var overlay = document.createElement("div");
    overlay.className = "explication-mouvement-overlay";
    var maxLane = -1;

    laned.forEach(function (it) {
      if (it.lane > maxLane) maxLane = it.lane;
      var top = it.openEl.getBoundingClientRect().top - stageBox.top;
      var bottom = it.closeEl.getBoundingClientRect().bottom - stageBox.top;
      var lineLeft = -LANE_BASE - it.lane * LANE_GAP;
      var hue = parseFloat(it.openEl.getAttribute("hue"));
      var color = isFinite(hue) ? "hsl(" + hue + ", 62%, 38%)" : "#664930";

      var hit = document.createElement("div");
      hit.className = "explication-mouvement-line-hit";
      hit.style.setProperty("--top", top + "px");
      hit.style.setProperty("--height", Math.max(bottom - top, 20) + "px");
      hit.style.setProperty("--left", (lineLeft - (HIT_WIDTH - LINE_WIDTH) / 2) + "px");
      hit._openEl = it.openEl;
      var line = document.createElement("div");
      line.className = "explication-mouvement-line";
      line.style.setProperty("--line-color", color);
      hit.appendChild(line);
      overlay.appendChild(hit);

      [top, bottom].forEach(function (y) {
        var dot = document.createElement("div");
        dot.className = "explication-mouvement-dot";
        dot.style.setProperty("--top", (y - DOT_SIZE / 2) + "px");
        dot.style.setProperty("--left", (lineLeft + LINE_WIDTH / 2 - DOT_SIZE / 2) + "px");
        dot.style.setProperty("--dot-color", color);
        overlay.appendChild(dot);
      });
    });

    stage.appendChild(overlay);
    if (wrap) {
      var gutter = maxLane < 0 ? 0 : LANE_BASE + maxLane * LANE_GAP + (HIT_WIDTH - LINE_WIDTH) / 2 + 12;
      wrap.style.setProperty("--mouvement-gutter", gutter + "px");
    }
  }

  function renderAll() {
    clearOutlines();
    renderOutlinesFor("concept");
    renderOutlinesFor("exemple");
    renderMouvementOverlay();
  }

  /* ---- bulle de lecture : clic sur une annotation -> définition/description ---- */
  var popover = document.createElement("div");
  popover.className = "xpl-popover";
  document.body.appendChild(popover);

  function showPopover(target, label, text) {
    popover.innerHTML = '<div class="xpl-popover-label"></div><div></div>';
    popover.querySelector(".xpl-popover-label").textContent = label;
    popover.lastElementChild.textContent = text || "(pas de remarque)";
    var r = target.getBoundingClientRect();
    var left = Math.max(8, Math.min(r.left, window.innerWidth - 8 - 352));
    popover.style.top = Math.min(r.bottom + 8, window.innerHeight - 8) + "px";
    popover.style.left = left + "px";
    popover.classList.add("is-open");
  }
  function hidePopover() { popover.classList.remove("is-open"); }

  document.addEventListener("click", function (e) {
    if (popover.contains(e.target)) return;

    var concept = e.target.closest("concept");
    if (concept) { showPopover(concept, "Concept", concept.getAttribute("definition")); return; }

    var exemple = e.target.closest("exemple");
    if (exemple) { showPopover(exemple, "Exemple", exemple.getAttribute("description")); return; }

    var marker = e.target.closest("crochetouvert, crochetferme");
    if (marker) {
      var pid = marker.getAttribute("pair");
      var openEl = pid ? canvas.querySelector('crochetouvert[pair="' + pid + '"]') : null;
      if (openEl) showPopover(marker, openEl.getAttribute("label") || "Mouvement", openEl.getAttribute("description"));
      return;
    }

    var lineHit = e.target.closest(".explication-mouvement-line-hit");
    if (lineHit && lineHit._openEl) {
      showPopover(lineHit, lineHit._openEl.getAttribute("label") || "Mouvement", lineHit._openEl.getAttribute("description"));
      return;
    }

    hidePopover();
  });
  window.addEventListener("scroll", hidePopover, true);

  renderAll();
  window.addEventListener("resize", renderAll);
})();
`;
}

/**
 * @param {string} title     titre affiché en haut du document (même
 *                            valeur que le `title` d'ExplicationEditor)
 * @param {string} rawHtml    HTML annoté brut (containerRef.current.innerHTML)
 */
export function buildStandaloneDocument({ title, rawHtml }) {
  const displayHtml = selfCloseVoidTags(rawHtml);
  const escapedSource = escapeForScriptTag(displayHtml);
  const safeTitle = escapeHtml(title || "Texte annoté");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>${inlineCss()}</style>
</head>
<body>
  <div class="explication-canvas-wrap">
    <header class="explication-canvas-header"><h1>${safeTitle}</h1></header>
    <div class="explication-canvas-stage">
      <div class="explication-canvas">${displayHtml}</div>
    </div>
  </div>

  <!-- Donnée canonique, invisible (type="text/plain" : jamais exécuté
       ni affiché) — c'est elle que l'éditeur relit à l'import, voir
       extractRawHtml() dans lib/standalone.js. Le rendu ci-dessus n'est
       qu'un affichage en lecture seule du même contenu. -->
  <script type="text/plain" id="explication-source">${escapedSource}</script>

  <script>${inlineScript()}</script>
</body>
</html>`;
}

/**
 * Relit le HTML brut annoté depuis un fichier standalone exporté par
 * buildStandaloneDocument(). Retourne null si le fichier ne contient
 * pas le marqueur attendu (pas un export de ce module).
 */
export function extractRawHtml(fileText) {
  const doc = new DOMParser().parseFromString(fileText, "text/html");
  const src = doc.getElementById("explication-source");
  if (!src) return null;
  return unescapeFromScriptTag(src.textContent || "");
}