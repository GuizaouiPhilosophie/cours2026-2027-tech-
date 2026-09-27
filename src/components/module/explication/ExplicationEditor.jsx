import { useCallback, useEffect, useRef, useState } from "react";
import tools from "./toolRegistry";
import { startGrab, snapBetweenWords } from "./lib/grab";
import { buildStandaloneDocument, extractRawHtml, selfCloseVoidTags } from "./lib/standalone";
import "./explication.css";

// Nom de fichier à partir du titre : minuscules, accents retirés,
// tout ce qui n'est pas alphanumérique -> tiret.
function slugify(s) {
  return (
    (s || "explication")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "explication"
  );
}

/* ---------- sauvegarde automatique dans le navigateur (localStorage) ---------- */

const AUTOSAVE_PREFIX = "explication-autosave:";
const AUTOSAVE_DEBOUNCE_MS = 400;

function readAutosave(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.rawHtml === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeAutosave(key, data) {
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // quota dépassé, navigation privée... : on ignore silencieusement,
    // l'export manuel reste le filet de sécurité en dernier recours.
  }
}

function clearAutosave(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function useRealViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    const setHeight = () => {
      const h = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${h}px`);
    };
    setHeight();
    const target = vv || window;
    target.addEventListener("resize", setHeight);
    target.addEventListener("scroll", setHeight);
    return () => {
      target.removeEventListener("resize", setHeight);
      target.removeEventListener("scroll", setHeight);
    };
  }, []);
}

// `autosaveId`, optionnel : clé stable à préférer si l'appelant en a une
// sous la main (id de la leçon en base, par ex.) — à défaut on retombe
// sur le titre. Un titre qui change en cours d'édition change alors la
// clé de sauvegarde (nouveau brouillon "vide" pour ce titre) : passer
// `autosaveId` quand une valeur stable existe évite ce piège.
export default function ExplicationEditor({ title, html, autosaveId }) {
  useRealViewportHeight();
  const containerRef = useRef(null);
  const initializedRef = useRef(false);
  const fileInputRef = useRef(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [previewRect, setPreviewRect] = useState(null);

  const storageKey = `${AUTOSAVE_PREFIX}${autosaveId || slugify(title)}`;
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;
  const titleRef = useRef(title);
  titleRef.current = title;

  // `restoredDraftAt` : non-null tant que le bandeau "brouillon
  // récupéré" doit rester visible (posé une seule fois, au chargement,
  // s'il y avait un brouillon plus récent que `html`).
  const [restoredDraftAt, setRestoredDraftAt] = useState(null);
  const saveTimeoutRef = useRef(null);

  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const container = containerRef.current;
    if (!container) return;
    writeAutosave(storageKeyRef.current, {
      title: titleRef.current,
      rawHtml: container.innerHTML,
      savedAt: Date.now(),
    });
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(flushSave, AUTOSAVE_DEBOUNCE_MS);
  }, [flushSave]);

  // Menu du bas : chaque outil peut y avoir une catégorie (badge quand
  // fermé + panneau de cards quand ouvert — voir tools/mouvement.jsx).
  // `bounceTarget` change de référence à chaque appel de `openPanel`
  // (même id inclus) pour que le panneau puisse rejouer l'animation de
  // "bond" même si on reclique deux fois de suite sur le même trait.
  const [panelOpen, setPanelOpen] = useState(false);
  const [activePanelTool, setActivePanelTool] = useState(null);
  const [bounceTarget, setBounceTarget] = useState(null);

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  // `bounceTarget` ne doit rester "vivant" que le temps de l'animation
  // (650ms côté PanelContent de chaque outil) : sans ça, il reste en
  // mémoire indéfiniment et une fermeture/réouverture ultérieure du
  // panneau (ex. via l'onglet du bas) remonte PanelContent, dont le
  // useEffect([bounceTarget]) se redéclenche une première fois avec
  // cette valeur périmée — rejouant le rebond sur une card qu'on n'a
  // pourtant pas reciblée. On le vide donc nous-mêmes juste après,
  const bounceTimeoutRef = useRef(null);
  const helpers = {
    bump,
    openPanel(toolId, targetId) {
      setActivePanelTool(toolId);
      setPanelOpen(true);
      setBounceTarget({ toolId, id: targetId, ts: Date.now() });
      if (bounceTimeoutRef.current) clearTimeout(bounceTimeoutRef.current);
      bounceTimeoutRef.current = setTimeout(() => setBounceTarget(null), 700);
    },
  };

  // Export : un seul fichier .html téléchargé, à la fois consultable
  // seul (contours/traits redessinés en lecture seule, voir
  // lib/standalone.js) et rechargeable ici (le HTML brut annoté est
  // gardé verbatim dedans, voir extractRawHtml plus bas).
  function handleExportFile() {
    const rawHtml = containerRef.current?.innerHTML || html;
    const doc = buildStandaloneDocument({ title, rawHtml });
    const blob = new Blob([doc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(title)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Import : relit le fichier exporté par handleExportFile ci-dessus,
  // remplace le contenu du canvas par le HTML brut retrouvé, et
  // ré-hydrate chaque outil dessus — exactement comme au premier
  // chargement (useEffect([html]) plus bas).
  function handleImportFile(e) {
    const file = e.target.files?.[0];
    // Vidé tout de suite : sans ça, choisir deux fois le même fichier
    // d'affilée ne redéclenche pas onChange (value inchangée).
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const container = containerRef.current;
      const rawHtml = extractRawHtml(String(reader.result || ""));
      if (!rawHtml || !container) {
        window.alert("Ce fichier ne contient pas de texte d'explication reconnu.");
        return;
      }
      container.innerHTML = rawHtml;
      tools.forEach((t) => t.hydrate?.(container, helpers));
      setPanelOpen(false);
      // Le fichier importé devient la nouvelle base : on l'enregistre
      // tout de suite (pas d'attente du debounce) et on efface le
      // bandeau de brouillon restauré, qui ne concerne plus ce contenu.
      setRestoredDraftAt(null);
      flushSave();
      bump();
    };
    reader.readAsText(file);
  }

  // Abandonne le brouillon récupéré et repart du texte d'origine reçu
  // en props (cas où l'élève préfère annuler ses modifications non
  // exportées plutôt que de continuer dessus).
  function handleDiscardDraft() {
    clearAutosave(storageKeyRef.current);
    const container = containerRef.current;
    if (container) {
      container.innerHTML = html;
      tools.forEach((t) => t.hydrate?.(container, helpers));
      bump();
    }
    setPanelOpen(false);
    setRestoredDraftAt(null);
  }

  useEffect(() => {
    if (containerRef.current && !initializedRef.current) {
      const draft = readAutosave(storageKey);
      const useDraft = !!draft && draft.rawHtml !== html;
      containerRef.current.innerHTML = useDraft ? draft.rawHtml : html;
      initializedRef.current = true;
      tools.forEach((t) => t.hydrate?.(containerRef.current, helpers));
      if (useDraft) setRestoredDraftAt(draft.savedAt || Date.now());
      bump();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  // Sauvegarde automatique : n'importe quelle mutation du canvas (texte
  // tapé, objet posé/déplacé/supprimé par un outil, attribut de card
  // modifié...) planifie une écriture dans localStorage. Attaché après
  // l'effet d'initialisation ci-dessus, pour ne pas déclencher une
  // sauvegarde inutile sur le tout premier remplissage du canvas.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const observer = new MutationObserver(scheduleSave);
    observer.observe(el, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => observer.disconnect();
  }, [scheduleSave]);

  // Filet de sécurité : si la page se ferme/actualise pendant la fenêtre
  // du debounce (juste après une frappe), on force l'écriture immédiate
  // plutôt que de perdre les toutes dernières modifications.
  useEffect(() => {
    window.addEventListener("beforeunload", flushSave);
    window.addEventListener("pagehide", flushSave);
    return () => {
      window.removeEventListener("beforeunload", flushSave);
      window.removeEventListener("pagehide", flushSave);
      flushSave();
    };
  }, [flushSave]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(bump);
    ro.observe(el);
    window.addEventListener("resize", bump);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", bump);
    };
  }, [bump]);

  useEffect(() => {
    return () => {
      if (bounceTimeoutRef.current) clearTimeout(bounceTimeoutRef.current);
    };
  }, []);

  // Démarre une prise en main depuis la barre d'outils : chaque outil peut
  // fournir sa propre stratégie de snap (`tool.snap`, voir lib/grab.js —
  // par défaut "entre les mots") et, s'il le souhaite, son propre fantôme
  // (`tool.ghost`). Par défaut, sans `tool.ghost`, c'est le chip cliqué
  // lui-même (`e.currentTarget`) qui est cloné pour servir de fantôme,
  // et c'est LUI qui disparaît de la barre pendant le transport (voir
  // `sourceEl` dans startGrab) : visuellement, c'est bien l'objet du menu
  // qu'on prend et déplace, et un nouveau ne "réapparaît" dans son
  // emplacement qu'une fois la souris relâchée. La mécanique (suivre la
  // souris, cacher/réafficher la source, calculer le point de dépôt) est
  // entièrement dans lib/grab.js et identique pour tous les outils.
  const startDrag = (tool) => (payload) => (e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const sourceEl = e.currentTarget;
    const resolve = tool.snap || snapBetweenWords;
    const ghostContent = tool.ghost ? tool.ghost(payload) : sourceEl.cloneNode(true);

    startGrab({
      container,
      resolve,
      ghostContent,
      sourceEl,
      event: e,
      onPreview(found) {
        if (!found) {
          setPreviewRect(null);
          return;
        }
        const rect = found.range.getClientRects()[0] || found.range.getBoundingClientRect();
        const stageBox = container.parentElement.getBoundingClientRect();
        setPreviewRect({
          toolId: tool.id,
          kind: found.kind,
          top: rect.top - stageBox.top,
          left: rect.left - stageBox.left,
          width: found.kind === "word" ? rect.width : undefined,
          height: rect.height || 20,
        });
      },
      onDrop(found) {
        tool.onDrop?.({ range: found.range, payload, container, helpers });
      },
    });
  };

  // Étiquettes visibles menu fermé : un outil n'apparaît que s'il a au
  // moins une instance dans le texte (`getBadge` renvoie null sinon).
  // Recalculé à chaque rendu (comme les OverlayLayer ci-dessus), donc à
  // jour dès que `version` bouge.
  const container = containerRef.current;
  const badges = tools
    .map((tool) => (typeof tool.getBadge === "function" && container ? { tool, badge: tool.getBadge(container) } : null))
    .filter((x) => x && x.badge);
  const activeTool = tools.find((t) => t.id === activePanelTool);

  return (
    <div className="explication-editor">
      <aside className="explication-toolbar">
        <div className="explication-toolbar-tools">
          {tools.map((tool) => (
            <div key={tool.id} className="explication-tool-slot" title={tool.description || tool.label}>
              {tool.ToolbarWidget ? (
                <tool.ToolbarWidget startDrag={startDrag(tool)} containerRef={containerRef} helpers={helpers} />
              ) : (
                <span className="explication-tool-label">{tool.label}</span>
              )}
            </div>
          ))}
        </div>

        {/*
          Export / import : rangés dans la toolbar plutôt que dans l'en-tête
          du canvas, pour rester à portée dans la même barre que les outils.
          Poussés en bas via .explication-toolbar-actions (margin-top: auto)
          sur ordi -> juste au-dessus de la poubelle ; sur mobile, la barre
          devient une ligne et ce même bloc passe à l'extrémité droite (voir
          la media query dans explication.css).
        */}
        <div className="explication-trash" title="Glisser ici pour supprimer">
          🗑
        </div>
        <div className="explication-toolbar-actions">
          <button
            type="button"
            className="explication-tool-btn"
            onClick={handleExportFile}
            title="Exporter en fichier .html (consultable seul, rechargeable ici)"
          >
            <span className="explication-tool-icon">⇩</span>
            <span className="explication-tool-label">Exporter</span>
          </button>
          <button
            type="button"
            className="explication-tool-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Importer un fichier .html exporté depuis cet éditeur"
          >
            <span className="explication-tool-icon">⇧</span>
            <span className="explication-tool-label">Importer</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,text/html"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
        </div>
      </aside>

      <div className="explication-content-col">
        <main className="explication-canvas-wrap">
          <header className="explication-canvas-header">
            <h1>{title}</h1>
          </header>

          {restoredDraftAt && (
            <div className="explication-draft-banner" role="status">
              <span>
                Sauvegarde locale du{" "}
                {new Date(restoredDraftAt).toLocaleString("fr-FR")}.
              </span>
              <div className="explication-draft-banner-actions">
                <button type="button" onClick={() => setRestoredDraftAt(null)}>
                  Ignorer
                </button>
                <button type="button" onClick={handleDiscardDraft}>
                  Revenir à la version d'origine
                </button>
              </div>
            </div>
          )}

          <div className="explication-canvas-stage">
            <div className="explication-canvas" ref={containerRef} />

            {previewRect && (() => {
              // Chaque outil peut définir son propre aperçu de dépôt
              // (`PreviewMarker`, ex. le pointillé rouge de Concept, déjà
              // utilisé pour le redéplacement d'un concept posé) : on
              // l'utilise s'il existe, pour que le premier dépôt depuis la
              // barre d'outils ait le même rendu qu'un redéplacement.
              // Sans PreviewMarker (ex. Mouvement), on garde l'encart
              // générique d'origine.
              const previewTool = tools.find((t) => t.id === previewRect.toolId);
              if (previewTool?.PreviewMarker) {
                return <previewTool.PreviewMarker rect={previewRect} />;
              }
              return (
                <div
                  className={
                    previewRect.kind === "word"
                      ? "explication-drop-preview explication-drop-preview--word"
                      : "explication-drop-preview"
                  }
                  style={{
                    top: previewRect.top,
                    left: previewRect.left,
                    height: previewRect.height,
                    width: previewRect.width,
                  }}
                />
              );
            })()}

            {tools.map((tool) =>
              tool.OverlayLayer ? (
                <tool.OverlayLayer key={tool.id} containerRef={containerRef} version={version} helpers={helpers} />
              ) : null
            )}
          </div>
        </main>

        {(badges.length > 0 || panelOpen) && (
          <div className="explication-panel-bar">
            <div className="explication-panel-tags">
              {badges.map(({ tool, badge }) => (
                <button
                  key={tool.id}
                  type="button"
                  className={`explication-panel-tag${panelOpen && activePanelTool === tool.id ? " is-active" : ""}`}
                  onClick={() => {
                    if (panelOpen && activePanelTool === tool.id) {
                      setPanelOpen(false);
                    } else {
                      setActivePanelTool(tool.id);
                      setPanelOpen(true);
                    }
                  }}
                >
                  <span>{badge.label}</span>
                  <span className="explication-panel-tag-count">{badge.count}</span>
                </button>
              ))}
              {panelOpen && (
                <button
                  type="button"
                  className="explication-panel-close"
                  onClick={() => setPanelOpen(false)}
                  title="Fermer le menu"
                >
                  ✕
                </button>
              )}
            </div>

            {panelOpen && activeTool?.PanelContent && (
              <div className="explication-panel-body">
                <activeTool.PanelContent
                  containerRef={containerRef}
                  version={version}
                  helpers={helpers}
                  bounceTarget={bounceTarget}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {exportOpen && (
        <div className="explication-export-modal" role="dialog" aria-modal="true">
          <div className="explication-export-modal-body">
            <div className="explication-export-modal-header">
              <h2>HTML exporté</h2>
              <button type="button" onClick={() => setExportOpen(false)}>
                Fermer
              </button>
            </div>
            <textarea readOnly value={selfCloseVoidTags(containerRef.current?.innerHTML || html)} />
          </div>
        </div>
      )}
    </div>
  );
}