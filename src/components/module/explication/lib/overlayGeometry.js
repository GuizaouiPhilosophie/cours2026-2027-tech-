/**
 * Géométrie pure du module d'explication : aucune fonction ici ne
 * touche au DOM en écriture (pas de createElement, pas de
 * style.setProperty), seulement du calcul à partir de rects/tableaux
 * déjà mesurés.
 *
 * Extrait de lib/groupOverlay.js et tools/mouvement.jsx, dont c'était
 * à l'origine des fonctions privées, pour que ce soit la MÊME
 * implémentation qui tourne :
 *  - ici, importée normalement, pour le contour en escalier de
 *    Concept/Exemple (groupOverlay.js) et les lanes des traits de
 *    Mouvement (mouvement.jsx) ;
 *  - dans le fichier .html standalone exporté (voir lib/standalone.js),
 *    qui embarque le CODE SOURCE de ces fonctions via .toString()
 *    plutôt que de le recopier à la main.
 *
 * Une fonction qui doit pouvoir être sérialisée ainsi doit rester
 * autonome : pas de référence à une variable extérieure au module (les
 * seules dépendances autorisées sont d'autres fonctions de ce même
 * fichier, elles aussi embarquées), pas de syntaxe qu'un navigateur
 * ne pourrait pas évaluer telle quelle une fois collée dans un <script>.
 */

/* ---------- contour en escalier (Concept, Exemple) ---------- */

export function pointsToRoundedPath(points, radius) {
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

export function rightEdgePoints(lines) {
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

export function leftEdgePoints(lines) {
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

export function buildStaircasePath(rects, stageBox, radius) {
  const r = radius == null ? 4 : radius;
  if (!rects.length) return "";
  const lines = Array.from(rects).map((rc) => ({
    top: rc.top - stageBox.top,
    left: rc.left - stageBox.left,
    right: rc.right - stageBox.left,
    bottom: rc.bottom - stageBox.top,
  }));
  return pointsToRoundedPath([...rightEdgePoints(lines), ...leftEdgePoints(lines)], r);
}

/* ---------- paires et lanes (Mouvement) ---------- */

// Tous les marqueurs (ouvrants et fermants) dans l'ordre du DOM — sert
// de référentiel d'index pour startIdx/endIdx ci-dessous.
export function allMarkers(container) {
  return Array.from(container.querySelectorAll("crochetouvert, crochetferme"));
}

// Paires complètes (les deux crochets présents), triées par ordre
// d'apparition du crochet ouvrant.
export function getPairs(container) {
  const markers = allMarkers(container);
  const grouped = new Map();
  markers.forEach((el) => {
    const pid = el.getAttribute("pair");
    if (!pid) return;
    if (!grouped.has(pid)) grouped.set(pid, {});
    grouped.get(pid)[el.tagName.toLowerCase() === "crochetouvert" ? "open" : "close"] = el;
  });

  const items = [];
  grouped.forEach((p, pid) => {
    if (p.open && p.close) {
      items.push({ pid, openEl: p.open, closeEl: p.close, startIdx: markers.indexOf(p.open) });
    }
  });
  return items.sort((a, b) => a.startIdx - b.startIdx);
}

/**
 * Attribution des lanes ("plus petite salle libre") : deux mouvements
 * qui se chevauchent (même partiellement) ne partagent jamais de lane,
 * donc jamais de traits confondus, quel que soit le niveau
 * d'imbrication.
 * `list` : items retournés par getPairs (ou un sous-ensemble).
 * `markers` : allMarkers(container) — passé à part plutôt que recalculé
 * ici, puisque l'appelant l'a déjà sous la main la plupart du temps.
 */
export function assignLanes(list, markers) {
  const sorted = [...list].sort((a, b) => a.startIdx - b.startIdx);
  const laneFreeFrom = [];
  const byPid = new Map();
  sorted.forEach((it) => {
    const endIdx = markers.indexOf(it.closeEl);
    let lane = laneFreeFrom.findIndex((end) => end < it.startIdx);
    if (lane === -1) {
      lane = laneFreeFrom.length;
      laneFreeFrom.push(endIdx);
    } else {
      laneFreeFrom[lane] = endIdx;
    }
    byPid.set(it.pid, lane);
  });
  return list.map((it) => ({ ...it, lane: byPid.get(it.pid) }));
}