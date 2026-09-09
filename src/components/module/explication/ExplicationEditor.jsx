import { useCallback, useEffect, useRef, useState } from "react";
import tools from "./toolRegistry";
import { startGrab, snapBetweenWords } from "./lib/grab";
import "./explication.css";

function selfClose(html) {
  return html
    .replace(/<crochetouvert([^>]*)>\s*<\/crochetouvert>/gi, "<crochetouvert$1/>")
    .replace(/<crochetferme([^>]*)>\s*<\/crochetferme>/gi, "<crochetferme$1/>");
}

export default function ExplicationEditor({ title, html }) {
  const containerRef = useRef(null);
  const initializedRef = useRef(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [previewRect, setPreviewRect] = useState(null);

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
  // pour qu'un remontage plus tard ne retrouve plus rien à rejouer.
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

  useEffect(() => {
    if (containerRef.current && !initializedRef.current) {
      containerRef.current.innerHTML = html;
      initializedRef.current = true;
      tools.forEach((t) => t.hydrate?.(containerRef.current, helpers));
      bump();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

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
                <tool.ToolbarWidget startDrag={startDrag(tool)} />
              ) : (
                <span className="explication-tool-label">{tool.label}</span>
              )}
            </div>
          ))}
        </div>

        {/*
          Poubelle : détectée par sélecteur (`.explication-trash`, voir
          lib/grab.js) depuis n'importe quel startGrab, qu'il soit démarré
          ici (drag d'un chip neuf depuis la barre) ou directement depuis
          un fichier outil (tools/mouvement.jsx, tools/concept.jsx, pour
          redéplacer/supprimer un objet déjà posé dans le texte). Rien
          d'autre à câbler ici : le survol et le lâcher sont gérés de bout
          en bout par startGrab lui-même.
        */}
        <div className="explication-trash" title="Glisser ici pour supprimer">
          🗑
        </div>
      </aside>

      <div className="explication-content-col">
        <main className="explication-canvas-wrap">
          <header className="explication-canvas-header">
            <h1>{title}</h1>
            <button type="button" className="explication-export-btn" onClick={() => setExportOpen(true)}>
              ↓
            </button>
          </header>

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
            <textarea readOnly value={selfClose(containerRef.current?.innerHTML || html)} />
          </div>
        </div>
      )}
    </div>
  );
}