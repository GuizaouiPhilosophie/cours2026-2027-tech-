/**
 * Outil "Mouvement" — pose deux marqueurs autofermants dans le texte,
 * <crochetouvert/> et <crochetferme/>, appariés par un attribut `pair`
 * commun (ordre d'apparition dans le DOM). La mécanique générique de
 * prise en main vient de ../lib/grab.js et celle du panneau du bas de
 * ../lib/panelList.js ; ce fichier ne porte que ce qui est propre à
 * Mouvement (forme des marqueurs, appariement, couleurs, overlay).
 */

import { startGrab, snapBetweenWords, makeId } from "../lib/grab";
import { usePanelList } from "../lib/panelList";
import ExplicationCard from "../ExplicationCard";
import "./mouvement.css";

/* ---------- couleur d'une paire ---------- */

// Angle doré : répartit les teintes uniformément sur le cercle, deux
// paires ne se retrouvent jamais voisines même très éloignées dans le
// temps de création (contrairement à un tirage aléatoire retenté).
const GOLDEN_ANGLE = 137.508;
let hueSeed = Math.random() * 360;
const nextHue = () => Math.round((hueSeed = (hueSeed + GOLDEN_ANGLE) % 360));

const markerColor = (hue) => ({ color: `hsl(${hue}, 62%, 30%)`, background: `hsl(${hue}, 62%, 90%)` });
const lineColor = (hue) => `hsl(${hue}, 62%, 38%)`;

function applyPairColor(el, hue) {
  if (!Number.isFinite(hue)) return;
  const { color, background } = markerColor(hue);
  el.style.setProperty("--marker-color", color);
  el.style.setProperty("--marker-bg", background);
}

/* ---------- création et appariement d'un marqueur ---------- */

function createMarker(kind) {
  const el = document.createElement(kind === "open" ? "crochetouvert" : "crochetferme");
  el.id = makeId(kind === "open" ? "co" : "cf");
  el.textContent = kind === "open" ? "[" : "]";
  el.className = "explication-mouvement-marker";
  return el;
}

function allMarkers(container) {
  return Array.from(container.querySelectorAll("crochetouvert, crochetferme"));
}

function partnerOf(el, container) {
  const pid = el.getAttribute("pair");
  if (!pid) return null;
  return allMarkers(container).find((m) => m !== el && m.getAttribute("pair") === pid) || null;
}

function confirmPair(a, b, bump) {
  const pairId = makeId("pair");
  const hue = nextHue();
  [a, b].forEach((el) => {
    el.setAttribute("pair", pairId);
    el.setAttribute("hue", hue);
    applyPairColor(el, hue);
  });
  bump && bump();
}

// Un crochet dont le partenaire disparaît redevient "solo" (couleur par
// défaut), sinon il ne pourrait plus jamais se réapparier.
function releasePartner(el, container) {
  const partner = partnerOf(el, container);
  if (!partner) return;
  partner.removeAttribute("pair");
  partner.removeAttribute("hue");
  partner.style.removeProperty("--marker-color");
  partner.style.removeProperty("--marker-bg");
}

// Tente d'apparier un marqueur qu'on vient de poser avec un candidat
// libre du bon type et du bon côté. S'il y en a plusieurs, surbrillance
// des candidats et on attend un clic de confirmation (ou Échap).
function pairAfterInsert(marker, container, bump) {
  const isOpen = marker.tagName.toLowerCase() === "crochetouvert";
  const wantedTag = isOpen ? "crochetferme" : "crochetouvert";
  const all = allMarkers(container);
  const idx = all.indexOf(marker);

  const candidates = all.filter(
    (el, i) => el.tagName.toLowerCase() === wantedTag && !el.hasAttribute("pair") && (isOpen ? i > idx : i < idx)
  );

  if (candidates.length === 0) return;
  if (candidates.length === 1) return confirmPair(marker, candidates[0], bump);

  candidates.forEach((el) => el.classList.add("explication-mouvement-marker--candidate"));
  function cleanup() {
    candidates.forEach((el) => el.classList.remove("explication-mouvement-marker--candidate"));
    container.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKey);
  }
  function onClick(e) {
    const target = candidates.find((c) => c === e.target || c.contains(e.target));
    if (!target) return;
    cleanup();
    confirmPair(marker, target, bump);
  }
  function onKey(e) {
    if (e.key === "Escape") cleanup();
  }
  container.addEventListener("click", onClick, true);
  window.addEventListener("keydown", onKey);
}

function attachHandlers(el, container, helpers) {
  // Lâché sur la poubelle : le mouvement entier disparaît (les 2 crochets).
  function removePair() {
    partnerOf(el, container)?.remove();
    el.remove();
    helpers.bump();
  }

  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ghost = el.cloneNode(true);
    ghost.classList.add("explication-mouvement-marker--ghost");

    startGrab({
      container,
      resolve: snapBetweenWords,
      ghostContent: ghost,
      sourceEl: el,
      event: e,
      onDrop({ range }) {
        el.remove();
        range.insertNode(el);
        helpers.bump();
      },
      onDelete: removePair,
    });
  });
}

/* ---------- barre d'outils ---------- */

function ToolbarWidget({ startDrag }) {
  return (
    <div className="explication-mouvement-widget">
      <span className="explication-mouvement-widget-label">Mouvement</span>
      <div className="explication-mouvement-widget-chips">
        <div className="explication-mouvement-chip" onPointerDown={startDrag({ kind: "open" })} title="Crochet ouvrant">
          [
        </div>
        <div className="explication-mouvement-chip" onPointerDown={startDrag({ kind: "close" })} title="Crochet fermant">
          ]
        </div>
      </div>
    </div>
  );
}

/* ---------- paires complètes, triées par apparition (overlay, badge, panneau) ---------- */

function getPairs(container) {
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

/* ---------- calque des traits entre marqueurs appariés ---------- */

function OverlayLayer({ containerRef, helpers }) {
  const container = containerRef.current;
  if (!container) return null;

  const stageBox = container.parentElement.getBoundingClientRect();
  const items = getPairs(container);

  // Attribution des lanes ("plus petite salle libre") : deux mouvements
  // qui se chevauchent (même partiellement) ne partagent jamais de lane,
  // donc jamais de traits confondus, quel que soit le niveau d'imbrication.
  function assignLanes(list) {
    const markers = allMarkers(container);
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

  const LANE_BASE = 24, LANE_GAP = 28, LINE_WIDTH = 3, HIT_WIDTH = 16, DOT_SIZE = 8;
  const laned = assignLanes(items);

  // Réserve, dans .explication-canvas-wrap, assez de place à gauche du
  // texte pour que les traits (et leur zone cliquable élargie, plus
  // large que le trait visuel) ne soient jamais rognés par l'overflow du
  // wrap : la lane la plus excentrée détermine le point le plus à
  // gauche atteint par un trait (`lineLeft - (HIT_WIDTH-LINE_WIDTH)/2`),
  // --mouvement-gutter (lu par explication.css) doit couvrir au moins
  // cette distance. Sans mouvement affiché, on remet le gutter à 0 pour
  // ne pas garder un vide inutile une fois tous les mouvements retirés.
  const wrapEl = container.parentElement.parentElement;
  if (wrapEl) {
    const maxLane = laned.reduce((m, it) => Math.max(m, it.lane), -1);
    const gutter = maxLane < 0 ? 0 : LANE_BASE + maxLane * LANE_GAP + (HIT_WIDTH - LINE_WIDTH) / 2 + 12;
    wrapEl.style.setProperty("--mouvement-gutter", `${gutter}px`);
  }

  return (
    <div className="explication-mouvement-overlay">
      {laned.map((it) => {
        const top = it.openEl.getBoundingClientRect().top - stageBox.top;
        const bottom = it.closeEl.getBoundingClientRect().bottom - stageBox.top;
        const lineLeft = -LANE_BASE - it.lane * LANE_GAP;
        const hue = parseFloat(it.openEl.getAttribute("hue"));
        const color = Number.isFinite(hue) ? lineColor(hue) : "#664930";
        const open = () => helpers?.openPanel?.("mouvement", it.pid);

        return (
          <div key={it.pid}>
            {/* Clic sur le trait : ouvre le panneau et fait "bondir" sa card. */}
            <div
              role="button"
              tabIndex={0}
              title="Voir ce mouvement"
              onClick={open}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
              className="explication-mouvement-line-hit"
              style={{ "--top": `${top}px`, "--height": `${Math.max(bottom - top, 20)}px`, "--left": `${lineLeft - (HIT_WIDTH - LINE_WIDTH) / 2}px` }}
            >
              <div className="explication-mouvement-line" style={{ "--line-color": color }} />
            </div>
            {[top, bottom].map((y, i) => (
              <div
                key={i}
                className="explication-mouvement-dot"
                style={{ "--top": `${y - DOT_SIZE / 2}px`, "--left": `${lineLeft + LINE_WIDTH / 2 - DOT_SIZE / 2}px`, "--dot-color": color }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- badge + panneau du bas ---------- */

function getBadge(container) {
  const items = getPairs(container);
  return items.length ? { label: "Mouvement", count: items.length } : null;
}

function PanelContent({ containerRef, version, helpers, bounceTarget }) {
  const container = containerRef.current;
  const items = container ? getPairs(container) : [];
  const { order, byId, bouncingId, startCardDrag, setCardRef } = usePanelList({
    items,
    idKey: "pid",
    toolId: "mouvement",
    version,
    bounceTarget,
    onDelete(pid) {
      const it = items.find((x) => x.pid === pid);
      if (it) {
        it.openEl.remove();
        it.closeEl.remove();
      }
      helpers.bump();
    },
  });

  if (order.length === 0) return <p className="explication-panel-empty">Aucun mouvement pour l’instant.</p>;

  return (
    <div className="explication-panel-list">
      {order.map((pid) => {
        const it = byId.get(pid);
        if (!it) return null;
        const hue = parseFloat(it.openEl.getAttribute("hue"));
        const color = Number.isFinite(hue) ? lineColor(hue) : "#664930";
        const soft = Number.isFinite(hue) ? `hsl(${hue}, 55%, 93%)` : "#f2e9de";

        return (
          <ExplicationCard
            key={pid}
            cardRef={setCardRef(pid)}
            accentColor={color}
            background={soft}
            bouncing={bouncingId === pid}
            onGripPointerDown={startCardDrag(pid)}
            title={{
              value: it.openEl.getAttribute("label") || "",
              placeholder: "Titre du mouvement…",
              onChange: (val) => it.openEl.setAttribute("label", val),
            }}
            description={{
              value: it.openEl.getAttribute("description") || "",
              placeholder: "Description…",
              onChange: (val) => it.openEl.setAttribute("description", val),
            }}
          />
        );
      })}
    </div>
  );
}

/* ---------- export du tool ---------- */

export default {
  id: "mouvement",
  label: "Mouvement",
  icon: "[ ]",
  description: "Glisser un crochet ouvrant et un crochet fermant pour délimiter un mouvement du texte.",
  order: 10,
  snap: snapBetweenWords, // dépôt ENTRE deux mots ; pas de `ghost` custom, le chip cliqué suffit (voir startDrag dans ExplicationEditor)

  ToolbarWidget,
  OverlayLayer,
  getBadge,
  PanelContent,

  // Marqueurs pré-existants dans le HTML importé : on leur attache leur
  // comportement, et on colore les paires déjà formées mais sans teinte.
  hydrate(container, helpers) {
    allMarkers(container).forEach((el) => attachHandlers(el, container, helpers));

    const byPair = new Map();
    allMarkers(container).forEach((el) => {
      const pid = el.getAttribute("pair");
      if (!pid) return;
      if (!byPair.has(pid)) byPair.set(pid, []);
      byPair.get(pid).push(el);
    });
    byPair.forEach((els) => {
      if (els.some((el) => el.hasAttribute("hue"))) return;
      const hue = nextHue();
      els.forEach((el) => {
        el.setAttribute("hue", hue);
        applyPairColor(el, hue);
      });
    });
  },

  onDrop({ range, payload, container, helpers }) {
    const el = createMarker(payload.kind);
    range.insertNode(el);
    attachHandlers(el, container, helpers);
    pairAfterInsert(el, container, helpers.bump);
    helpers.bump();
  },
};