import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import tools from "./toolRegistry";
import PlanPanel from "./PlanPanel";
import { subscribeArmed, disarm, markTapSource, isTouchDevice } from "./lib/tapPlace";
import { useVisibleViewport } from "../../../lib/useVisibleViewport";
import { useFullscreen } from "../../../lib/useFullscreen";
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

// `autosaveId`, optionnel : clé stable à préférer si l'appelant en a une
// sous la main (id de la leçon en base, par ex.) — à défaut on retombe
// sur le titre. Un titre qui change en cours d'édition change alors la
// clé de sauvegarde (nouveau brouillon "vide" pour ce titre) : passer
// `autosaveId` quand une valeur stable existe évite ce piège.
/** Texte de la pilule affichée quand un crochet est « armé » (placement en deux touchers, mobile). */
function armedHint(a) {
  if (!a) return null;
  if (a.el) return "Touchez la nouvelle place du crochet";
  return a.key === "close" ? "Touchez la fin du mouvement" : "Touchez le début du mouvement";
}

export default function ExplicationEditor({ title, meta = {}, html, autosaveId }) {
  useVisibleViewport(); // clavier mobile : l'éditeur se cale sur la zone visible
  const fullscreen = useFullscreen();
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
  // Statut affiché dans l'en-tête : « Enregistré » après chaque sauvegarde automatique.
  const [savedAt, setSavedAt] = useState(null);
  const [armed, setArmed] = useState(null);
  useEffect(() => subscribeArmed((a) => setArmed(a ? { key: a.key, el: a.el ?? null } : null)), []);

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
    setSavedAt(Date.now());
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
  // Onglets du panneau : un par outil (même vide, pour savoir qu'il existe), plus « Plan ».
  const PLURAL = { mouvement: "Mouvements", concept: "Concepts", exemple: "Exemples" };
  const tabs = [
    ...tools
      .filter((tool) => tool.PanelContent)
      .map((tool) => {
        const badge = container && typeof tool.getBadge === "function" ? tool.getBadge(container) : null;
        return { id: tool.id, label: PLURAL[tool.id] ?? badge?.label ?? tool.label, count: badge?.count ?? 0 };
      }),
    { id: "plan", label: "Plan", count: null },
  ];
  const activeTool = tools.find((t) => t.id === activePanelTool);
  const toggleTab = (id) => {
    if (panelOpen && activePanelTool === id) setPanelOpen(false);
    else {
      setActivePanelTool(id);
      setPanelOpen(true);
    }
  };
  const { auteur, oeuvre, date, pages } = meta;
  const kicker = ["Explication de texte", auteur].filter(Boolean).join(" · ");
  const touch = isTouchDevice();

  const fileActions = (
    <div className="explication-file-actions">
      {savedAt && (
        <span className="explication-saved" role="status">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          <span className="explication-saved-label">Enregistré</span>
        </span>
      )}
      <button
        type="button"
        className="explication-pill"
        onClick={handleExportFile}
        title="Exporter en fichier .html (consultable seul, rechargeable ici)"
        aria-label="Exporter"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 15V3" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        <span className="explication-pill-label">Exporter</span>
      </button>
      <button
        type="button"
        className="explication-disc"
        onClick={() => fileInputRef.current?.click()}
        aria-label="Importer un fichier exporté depuis cet éditeur"
        title="Importer un fichier .html exporté depuis cet éditeur"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12" />
          <path d="M7 8l5-5 5 5" />
          <path d="M5 21h14" />
        </svg>
      </button>
      <input ref={fileInputRef} type="file" accept=".html,text/html" style={{ display: "none" }} onChange={handleImportFile} />
      {fullscreen.supported && (
        <button
          type="button"
          className="explication-disc"
          onClick={fullscreen.toggle}
          aria-label={fullscreen.isFullscreen ? "Quitter le plein écran" : "Passer en plein écran"}
          title={fullscreen.isFullscreen ? "Quitter le plein écran" : "Plein écran"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {fullscreen.isFullscreen ? (
              <path d="M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5" />
            ) : (
              <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
            )}
          </svg>
        </button>
      )}
    </div>
  );

  return (
    <div className="explication-editor">
      <aside className="explication-toolbar" aria-label="Outils d’annotation">
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
        <p className="explication-toolbar-hint">
          {touch ? "Touchez un outil, puis le texte" : "Glissez un outil sur le texte"}
        </p>

        {/* Poubelle : on y dépose un objet du texte ou une card pour le supprimer (aussi possible
            avec le bouton de chaque card). Sur mobile, elle termine la barre d'outils du bas. */}
        <div className="explication-trash" title="Glisser ici pour supprimer">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
          <span className="explication-trash-label">Déposer pour supprimer</span>
        </div>
      </aside>

      <div className="explication-content-col">
        <header className="explication-header">
          <Link to="/" className="explication-disc explication-back" aria-label="Retour au cours" title="Retour au cours">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="explication-titles">
            <span className="explication-kicker">{kicker}</span>
            <h1>{oeuvre ? `${oeuvre}${date ? ` (${date})` : ""}` : title}</h1>
            {pages && <p className="explication-subtitle" title={pages}>{pages}</p>}
          </div>
          {fileActions}
        </header>

        <main className="explication-canvas-wrap">
          {restoredDraftAt && (
            <div className="explication-draft-banner" role="status">
              <span>
                Votre travail du {new Date(restoredDraftAt).toLocaleString("fr-FR")} a été repris.
              </span>
              <div className="explication-draft-banner-actions">
                <button type="button" onClick={() => setRestoredDraftAt(null)}>
                  Continuer
                </button>
                <button type="button" onClick={handleDiscardDraft}>
                  Revenir au texte d’origine
                </button>
              </div>
            </div>
          )}

          <div className="explication-canvas-stage">
            <div className="explication-canvas" ref={containerRef} />

            {previewRect && (() => {
              // Chaque outil peut définir son propre aperçu de dépôt
              // (`PreviewMarker`, ex. le pointillé rouge de Concept) : on
              // l'utilise s'il existe, sinon l'encart générique.
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

        {armed && (
          <div className="explication-armed" role="status" ref={(el) => markTapSource(el)}>
            <span className="explication-armed-icon" aria-hidden="true">
              [
            </span>
            <span>{armedHint(armed)}</span>
            <button type="button" onClick={() => disarm()}>
              Annuler
            </button>
          </div>
        )}

        <section className={`explication-panel-bar${panelOpen ? " is-open" : ""}`} aria-label="Annotations">
          <div className="explication-panel-tags" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={panelOpen && activePanelTool === t.id}
                className={`explication-panel-tag${panelOpen && activePanelTool === t.id ? " is-active" : ""}`}
                onClick={() => toggleTab(t.id)}
              >
                <span>{t.label}</span>
                {t.count !== null && <span className="explication-panel-tag-count">{t.count}</span>}
              </button>
            ))}
            {panelOpen && (
              <button
                type="button"
                className="explication-panel-close"
                onClick={() => setPanelOpen(false)}
                aria-label="Réduire le panneau"
                title="Réduire le panneau"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            )}
          </div>

          {panelOpen && (
            <div className="explication-panel-body" role="tabpanel">
              {activePanelTool === "plan" ? (
                <PlanPanel containerRef={containerRef} version={version} />
              ) : (
                activeTool?.PanelContent && (
                  <activeTool.PanelContent
                    containerRef={containerRef}
                    version={version}
                    helpers={helpers}
                    bounceTarget={bounceTarget}
                  />
                )
              )}
            </div>
          )}
        </section>
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