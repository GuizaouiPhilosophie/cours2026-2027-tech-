/* Logique générique de "grab" pour le module d'explication. */

const WORD_RE = /[A-Za-zÀ-ÖØ-öø-ÿ0-9œŒæÆ'’-]/;
const isWordChar = (c) => c && WORD_RE.test(c);

// Générateur d'id unique, repris à l'identique par chaque outil
// (crochets de Mouvement, <concept>...) : un compteur par préfixe suffit,
// pas besoin d'unicité entre outils différents.
const counters = {};
export function makeId(prefix) {
  counters[prefix] = (counters[prefix] || 0) + 1;
  return `${prefix}-${Date.now().toString(36)}-${counters[prefix]}`;
}

/**
 * La poubelle est cherchée par sélecteur plutôt que passée en paramètre à
 * chaque appel de startGrab : elle vit dans la barre d'outils (rendue par
 * ExplicationEditor.jsx), loin des endroits qui posent des objets dans le
 * texte (tools/mouvement.jsx, tools/concept.jsx). Un sélecteur global évite
 * à chaque outil de devoir se faire passer une référence DOM en plus du
 * `container` pour une fonctionnalité qui n'a rien de spécifique à l'outil.
 */
const TRASH_SELECTOR = ".explication-trash";

function isPointInRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Test générique "le point est-il au-dessus de la poubelle ?", avec
 * effet de bord visuel (surbrillance) inclus — même logique que celle
 * intégrée à startGrab, mais exposée à part pour les mécaniques de drag
 * qui n'y passent pas, comme le réordonnancement des cards du panneau
 * du bas (voir lib/panelList.js, startFreeDrag).
 */
export function trashHitTest(clientX, clientY) {
  const trash = document.querySelector(TRASH_SELECTOR);
  const over = !!(trash && isPointInRect(clientX, clientY, trash.getBoundingClientRect()));
  if (trash) trash.classList.toggle("is-drag-over", over);
  return { trash, over };
}

// À appeler au lâcher (ou à l'annulation) d'un drag qui a pu survoler la
// poubelle via trashHitTest, pour ne pas laisser la surbrillance collée
// si le dernier point testé était justement au-dessus.
export function clearTrashHighlight() {
  document.querySelector(TRASH_SELECTOR)?.classList.remove("is-drag-over");
}

/**
 * Range brut (non snappé) sous le point (clientX, clientY), ou null si le
 * point tombe hors de `container` ou hors de tout texte.
 */
function rawRangeFromPoint(container, clientX, clientY) {
  const box = container.getBoundingClientRect();
  if (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom) {
    return null;
  }

  let range = null;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(clientX, clientY);
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(clientX, clientY);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.setEnd(pos.offsetNode, pos.offset);
    }
  }
  if (!range || !container.contains(range.startContainer)) return null;
  return range;
}

/**
 * Stratégie "entre les mots" : point de dépôt = un curseur (Range vide),
 * ramené à la frontière de mot la plus proche si on tombe en plein milieu
 * d'un mot. Utilisée par Mouvement.
 *
 * Retourne { range, kind: "caret" } ou null.
 */
export function snapBetweenWords(container, clientX, clientY) {
  const range = rawRangeFromPoint(container, clientX, clientY);
  if (!range) return null;

  const node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue;
    let offset = range.startOffset;
    if (isWordChar(text[offset - 1]) && isWordChar(text[offset])) {
      let left = offset;
      let right = offset;
      while (left > 0 && isWordChar(text[left - 1])) left -= 1;
      while (right < text.length && isWordChar(text[right])) right += 1;
      offset = offset - left <= right - offset ? left : right;
    }
    const snapped = document.createRange();
    snapped.setStart(node, offset);
    snapped.setEnd(node, offset);
    return { range: snapped, kind: "caret" };
  }
  return { range, kind: "caret" };
}

/**
 * Stratégie "sur un mot" : point de dépôt = le mot entier sous le
 * curseur (Range qui sélectionne le mot). Retourne null si le curseur
 * n'est pas au-dessus d'un mot. Pensée pour un outil comme Concept.
 *
 * Retourne { range, kind: "word" } ou null.
 */
export function snapOnWord(container, clientX, clientY) {
  const range = rawRangeFromPoint(container, clientX, clientY);
  if (!range) return null;

  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;

  const text = node.nodeValue;
  let offset = range.startOffset;
  // Si on tombe juste après le mot (bord du nœud, ponctuation...), on
  // recule d'un cran pour rattraper le mot qui précède le point exact.
  if (!isWordChar(text[offset]) && isWordChar(text[offset - 1])) offset -= 1;
  if (!isWordChar(text[offset])) return null;

  let left = offset;
  let right = offset;
  while (left > 0 && isWordChar(text[left - 1])) left -= 1;
  while (right < text.length && isWordChar(text[right])) right += 1;

  const wordRange = document.createRange();
  wordRange.setStart(node, left);
  wordRange.setEnd(node, right);
  return { range: wordRange, kind: "word" };
}

// Ponctuation "de fin de phrase" qu'un Exemple doit pouvoir absorber à
// son bord droit quand il se termine sur elle (un exemple est souvent
// une phrase entière, pas juste un mot, contrairement à Concept).
const TRAILING_PUNCT_RE = /[.,;:!?…»”’)\]}]/;
// Espace (insécable normale U+00A0, ou fine U+202F, voire une simple
// espace selon la saisie) précédant ; : ! ? en typographie française —
// contrairement au point ou à la virgule, qui restent collés au mot.
const PRE_PUNCT_SPACE_RE = /[ \u00A0\u202F]/;

function extendTrailingPunctuation(node, offset) {
  if (node.nodeType !== Node.TEXT_NODE) return { node, offset };
  const text = node.nodeValue;
  let i = offset;
  while (i < text.length) {
    if (TRAILING_PUNCT_RE.test(text[i])) {
      i += 1;
      continue;
    }
    // On n'avale une espace que si elle précède immédiatement un signe
    // de ponctuation — jamais l'espace "normale" qui sépare deux mots.
    if (PRE_PUNCT_SPACE_RE.test(text[i]) && TRAILING_PUNCT_RE.test(text[i + 1])) {
      i += 1;
      continue;
    }
    break;
  }
  return { node, offset: i };
}

/**
 * Comme snapOnWord, mais avale aussi la ponctuation qui suit
 * immédiatement le mot trouvé (point, virgule, points de suspension,
 * guillemet/parenthèse fermants...). Réservé à Exemple : Concept doit
 * rester strictement un mot, sans ponctuation.
 *
 * Retourne { range, kind: "word" } ou null.
 */
export function snapOnWordWithPunctuation(container, clientX, clientY) {
  const found = snapOnWord(container, clientX, clientY);
  if (!found) return null;
  const end = extendTrailingPunctuation(found.range.endContainer, found.range.endOffset);
  const range = document.createRange();
  range.setStart(found.range.startContainer, found.range.startOffset);
  range.setEnd(end.node, end.offset);
  return { range, kind: "word" };
}

// Petite grille de décalages essayés autour du point exact, du plus
// proche au plus loin, tant qu'aucun mot n'a été trouvé. Couvre à la
// fois le tremblement de la main sur X (on rate le mot visé de
// quelques pixels, ou on tombe sur l'espace juste avant/après) et
// l'interligne sur Y (on lâche entre deux lignes plutôt que dessus).
const TOLERANT_DX = [0, -8, 8];
const TOLERANT_DY = [0, -14, 14];

/**
 * Comme snapOnWordWithPunctuation, mais tolérant à l'imprécision du
 * geste de dépôt : si le point exact ne tombe sur aucun mot (espace
 * entre deux mots, interligne entre deux lignes...), retente à
 * quelques pixels autour avant d'abandonner. Le mot renvoyé est
 * toujours entier (voir snapOnWord) : peu importe où dans le mot tombe
 * le point de dépôt, il est intégralement inclus, jamais coupé.
 *
 * Réservé aux poignées de redimensionnement d'Exemple (voir
 * tools/exemple.jsx) : le tout premier dépôt depuis la barre d'outils,
 * lui, reste strict (snapOnWord/snapOnWordWithPunctuation), pour ne
 * pas surprendre avec un mot différent de celui visuellement visé.
 */
export function snapOnWordTolerant(container, clientX, clientY) {
  for (const dy of TOLERANT_DY) {
    for (const dx of TOLERANT_DX) {
      const found = snapOnWordWithPunctuation(container, clientX + dx, clientY + dy);
      if (found) return found;
    }
  }
  return null;
}

/* ---------- fantôme qui suit la souris pendant le grab ---------- */

function createGhost(content, x, y) {
  const ghost = document.createElement("div");
  ghost.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "pointer-events:none",
    "z-index:9999",
    "opacity:0.85",
    "will-change:transform",
  ].join(";");
  ghost.style.transform = x != null ? `translate(${x}px, ${y}px)` : "translate(-9999px,-9999px)";

  if (content instanceof Node) {
    ghost.appendChild(content);
  } else if (typeof content === "string") {
    ghost.innerHTML = content;
  }

  document.body.appendChild(ghost);
  return ghost;
}

/**
 * Version "libre" de startGrab : même mécanique visuelle (fantôme qui
 * suit le curseur, source cachée pendant le transport, réapparition au
 * lâcher), mais sans résolution vers un Range dans le texte — l'appelant
 * reçoit juste les coordonnées brutes à chaque mousemove et décide lui-
 * même quoi en faire. Utilisée pour le glisser-déposer des cards dans le
 * panneau du bas (réordonnancement d'une liste), qui n'a rien à voir
 * avec un dépôt dans le texte.
 *
 * @param {string|Node} [ghostContent]  objet affiché sous le curseur pendant le drag
 * @param {HTMLElement} [sourceEl]      élément d'origine, caché tant que le transport dure
 * @param {PointerEvent} [event]        événement pointerdown d'origine, pour ancrer le fantôme au bon endroit sous le curseur
 * @param {Function} [onMove]           appelé à chaque pointermove avec l'événement brut
 * @param {Function} [onEnd]            appelé au lâcher (pointerup/pointercancel) avec l'événement brut
 */
export function startFreeDrag({ ghostContent, sourceEl, event, onMove, onEnd }) {
  let offsetX = 10;
  let offsetY = 12;
  if (event && sourceEl) {
    const rect = sourceEl.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
  }

  const initialX = event ? event.clientX - offsetX : undefined;
  const initialY = event ? event.clientY - offsetY : undefined;
  const ghost = ghostContent != null ? createGhost(ghostContent, initialX, initialY) : null;

  const prevVisibility = sourceEl ? sourceEl.style.visibility : undefined;
  if (sourceEl) sourceEl.style.visibility = "hidden";

  function onMoveInner(e) {
    if (ghost) {
      ghost.style.transform = `translate(${e.clientX - offsetX}px, ${e.clientY - offsetY}px)`;
    }
    onMove && onMove(e);
  }

  function cleanup() {
    window.removeEventListener("pointermove", onMoveInner);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (ghost) ghost.remove();
    if (sourceEl) sourceEl.style.visibility = prevVisibility || "";
  }

  function onUp(e) {
    cleanup();
    onEnd && onEnd(e);
  }

  window.addEventListener("pointermove", onMoveInner);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

/**
 * Démarre une prise en main générique : à appeler depuis un mousedown
 * (glisser un outil neuf depuis la barre, ou re-glisser un objet déjà
 * posé dans le texte).
 *
 * @param {HTMLElement} container            zone de texte cible du dépôt
 * @param {Function} resolve                 stratégie de snap : (container, x, y) => {range, kind} | null
 * @param {string|Node} [ghostContent]        objet affiché sous le curseur pendant le drag — en général un clone de `sourceEl`, pour que ce soit visuellement le même objet qui se déplace
 * @param {HTMLElement} [sourceEl]           élément d'origine (chip dans la barre, marqueur déjà posé...) : caché (visibility) tant que le transport dure, et qui réapparaît au lâcher
 * @param {PointerEvent} [event]             événement pointerdown d'origine (souris, tactile ou stylet) — sert à calculer où, sur `sourceEl`, le doigt/curseur a "attrapé" l'objet, pour que le fantôme garde ce même point sous lui au lieu d'être toujours ancré par un coin
 * @param {Function} [onPreview]             appelé à chaque mousemove avec le résultat de `resolve` (ou null) pour dessiner l'aperçu de dépôt
 * @param {Function} onDrop                  appelé au lâcher avec { range, kind } si un point valide a été trouvé
 * @param {Function} [onCancel]              appelé au lâcher si aucun point valide n'a été trouvé (dépôt hors zone)
 * @param {Function} [onDelete]              appelé au lâcher si le pointeur est au-dessus de la poubelle (`.explication-trash`,
 *                                            voir ExplicationEditor.jsx) — à cet outil de décider ce que "supprimer" veut dire
 *                                            (retirer un marqueur de Mouvement, dé-envelopper un Concept...). Sans `onDelete`
 *                                            fourni, lâcher sur la poubelle se comporte comme un dépôt hors zone (`onCancel`) —
 *                                            c'est le cas d'un chip neuf pris dans la barre d'outils, où il n'y a encore rien
 *                                            à supprimer. Pendant le survol de la poubelle, aucune stratégie de snap n'est
 *                                            évaluée (`resolve` n'est pas appelé) et l'aperçu de dépôt dans le texte est
 *                                            masqué (`onPreview(null)`), pour ne pas laisser croire à un dépôt dans le texte.
 */
export function startGrab({ container, resolve, ghostContent, sourceEl, event, onPreview, onDrop, onCancel, onDelete }) {
  // Décalage entre le point où la souris a saisi l'objet et le coin
  // haut-gauche de cet objet. Sans ça, le fantôme est toujours ancré par
  // son coin (visuellement "en bas à droite" du curseur) au lieu de
  // rester exactement là où on l'a attrapé.
  let offsetX = 10;
  let offsetY = 12;
  if (event && sourceEl) {
    const rect = sourceEl.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
  }

  const initialX = event ? event.clientX - offsetX : undefined;
  const initialY = event ? event.clientY - offsetY : undefined;
  const ghost = ghostContent != null ? createGhost(ghostContent, initialX, initialY) : null;
  let last = null;
  // Distinct de `last` : `last` reste `null` aussi bien "au-dessus de la
  // poubelle" que "hors de toute zone de dépôt valide", donc on retient
  // séparément lequel des deux cas s'applique au moment du lâcher.
  let overTrash = false;

  const prevVisibility = sourceEl ? sourceEl.style.visibility : undefined;
  if (sourceEl) sourceEl.style.visibility = "hidden";

  function onMove(e) {
    if (ghost) {
      ghost.style.transform = `translate(${e.clientX - offsetX}px, ${e.clientY - offsetY}px)`;
    }

    const trash = document.querySelector(TRASH_SELECTOR);
    overTrash = !!(trash && isPointInRect(e.clientX, e.clientY, trash.getBoundingClientRect()));
    if (trash) trash.classList.toggle("is-drag-over", overTrash);

    if (overTrash) {
      // Pas de résolution de Range tant qu'on est au-dessus de la
      // poubelle : ni le curseur "entre deux mots", ni le surlignage
      // "sur un mot" ne doivent laisser croire à un dépôt dans le texte.
      last = null;
      onPreview && onPreview(null);
      return;
    }

    last = resolve(container, e.clientX, e.clientY);
    onPreview && onPreview(last);
  }

  function cleanup() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (ghost) ghost.remove();
    const trash = document.querySelector(TRASH_SELECTOR);
    if (trash) trash.classList.remove("is-drag-over");
    // L'objet source réapparaît dès que la souris est lâchée, dépôt
    // valide ou non — comme un objet physique reposé quelque part. Si
    // `onDelete` le retire du DOM juste après, ça n'a simplement plus
    // d'effet visible.
    if (sourceEl) sourceEl.style.visibility = prevVisibility || "";
    onPreview && onPreview(null);
  }

  function onUp() {
    const droppedOnTrash = overTrash;
    cleanup();
    if (droppedOnTrash) {
      if (onDelete) {
        onDelete();
      } else {
        onCancel && onCancel();
      }
      return;
    }
    if (last) {
      onDrop(last);
    } else {
      onCancel && onCancel();
    }
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  // Un doigt qui quitte l'écran ou une interruption système (appel,
  // notification...) déclenche pointercancel plutôt que pointerup : sans
  // ce filet, l'objet resterait invisible (sourceEl caché) et le fantôme
  // collé à l'écran indéfiniment.
  window.addEventListener("pointercancel", onUp);
}