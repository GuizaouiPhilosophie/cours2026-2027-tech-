import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ReactFlow, ReactFlowProvider, Background, Controls, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./dissertation.css";
import StepPanel from "./StepPanel";
import ExportDialog from "./ExportDialog";
import steps from "./stepRegistry";
import { useFullscreen } from "./lib/useFullscreen";
import { WorkspaceContext } from "./lib/workspace";
import { SUBJECT_ID, NODE_Z, EDGE_Z } from "./lib/canvas";
import { rectAnchor, pointAnchor } from "./lib/anchor";
import NodeHandles from "./lib/NodeHandles";
import FloatingEdge from "./lib/FloatingEdge";
import { IoIcon } from "./lib/icons";
import {
  makeSnapshot,
  restoreSnapshot,
  loadFromStorage,
  saveToStorage,
  clearStorage,
  readSnapshotFile,
  downloadText,
  exportFileName,
  EMPTY_AUTHOR,
} from "./lib/persistence";
import { buildPosterHtml } from "./lib/poster";
import { loadDividerDataUrl } from "./lib/divider";

// Une étape peut remplacer le rendu du sujet (ex. mots cliquables de « Définition »).
const CustomSubjectText = steps.find((s) => s.SubjectText)?.SubjectText;

const DOUBLE_TAP_MS = 350;
const AUTOSAVE_MS = 400;
const DOUBLE_TAP_PX = 30;

/** Icône plein écran : coins vers l'extérieur (entrer) ou vers l'intérieur (quitter). */
function FullscreenIcon({ exit }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {exit ? (
        <path d="M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5" />
      ) : (
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
      )}
    </svg>
  );
}

/** Nœud central : le sujet de la dissertation. */
function SubjectNode({ data }) {
  const Text = CustomSubjectText;
  return (
    <div className="dissertation-subject-node">
      <NodeHandles />
      {Text ? <Text text={data.text} /> : <p>{data.text}</p>}
    </div>
  );
}

// Définis hors du composant : React Flow exige des références stables.
const nodeTypes = Object.assign({ subject: SubjectNode }, ...steps.map((s) => s.nodeTypes));
const edgeTypes = Object.assign({ floating: FloatingEdge }, ...steps.map((s) => s.edgeTypes));

const initialData = () => Object.fromEntries(steps.map((s) => [s.id, s.initial ? s.initial() : null]));

/** État de départ : la sauvegarde du navigateur si elle existe, sinon un travail vide. */
function bootState() {
  const restored = restoreSnapshot(loadFromStorage(), steps);
  return (
    restored ?? {
      subject: null,
      data: initialData(),
      validated: [],
      active: steps[0]?.id ?? null,
      ui: {},
      author: EMPTY_AUTHOR,
    }
  );
}

/** Données publiées par les étapes (topics). */
function buildTopics(data, subject) {
  const topics = {};
  for (const step of steps) {
    for (const [name, fn] of Object.entries(step.provides ?? {})) topics[name] = fn(data[step.id], { subject });
  }
  return topics;
}

/**
 * Carte complète, recalculée à partir des données des étapes (seule source de vérité du contenu).
 * Chaque nœud et lien est marqué de son étape propriétaire (data.owner). Les liens dont une extrémité
 * n'existe plus (ex. définition supprimée en revenant à l'étape 1) sont ignorés.
 */
function buildCanvas(subject, data, views, topics) {
  const nodes = [
    {
      id: SUBJECT_ID,
      type: "subject",
      position: { x: 0, y: 0 },
      data: { kind: "subject", label: "Sujet", text: subject, owner: null },
    },
  ];
  const edges = [];
  const decorations = {};

  for (const step of steps) {
    if (!step.canvas) continue;
    const out = step.canvas(data[step.id], { subject, topics, view: views[step.id] ?? {} }) ?? {};
    for (const n of out.nodes ?? []) nodes.push({ zIndex: NODE_Z, ...n, data: { ...n.data, owner: step.id } });
    for (const e of out.edges ?? []) {
      edges.push({ type: "floating", zIndex: EDGE_Z, selectable: false, ...e, data: { ...e.data, owner: step.id } });
    }
    for (const [id, d] of Object.entries(out.decorate ?? {})) {
      const cur = (decorations[id] ??= { classes: [] });
      if (d.className) cur.classes.push(d.className);
      if (d.zIndex !== undefined) cur.zIndex = d.zIndex;
    }
  }

  const ids = new Set();
  const decorated = nodes.map((n) => {
    ids.add(n.id);
    const d = decorations[n.id];
    if (!d) return n;
    return {
      ...n,
      className: d.classes.join(" ") || undefined,
      zIndex: d.zIndex ?? n.zIndex,
    };
  });
  return { nodes: decorated, edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
}

/** Lecture de la carte sans effet de bord (voir lib/workspace.js). */
function makeGraph(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return {
    hasNode: (id) => byId.has(id),
    getNode: (id) => byId.get(id) ?? null,
    describe: (id) => {
      const n = byId.get(id);
      return n
        ? { label: n.data.label ?? "", text: n.data.text ?? "", kind: n.data.kind ?? null, titled: !!n.data.titled }
        : { label: "Élément supprimé", text: "", kind: null, missing: true };
    },
  };
}

/** Applique à l'état d'affichage des nœuds (position, taille, sélection) les changements de React Flow. */
function applyUiChanges(prev, changes) {
  let next = prev;
  for (const c of changes) {
    const cur = next[c.id] ?? {};
    let upd = null;
    if (c.type === "position") upd = { ...cur, ...(c.position ? { position: c.position } : {}), dragging: !!c.dragging };
    else if (c.type === "dimensions" && c.dimensions) upd = { ...cur, measured: { ...c.dimensions } };
    else if (c.type === "select") upd = { ...cur, selected: c.selected };
    // Les suppressions sont ignorées : le contenu appartient aux étapes.
    if (upd) {
      if (next === prev) next = { ...prev };
      next[c.id] = upd;
    }
  }
  return next;
}

/**
 * Enveloppe l'éditeur des `Provider` des étapes, de la première (extérieure) à la dernière.
 */
function StepProviders({ statusOf, data, views, binders, children }) {
  return steps.reduceRight((acc, step) => {
    if (!step.Provider) return acc;
    const b = binders[step.id];
    return (
      <step.Provider
        key={step.id}
        status={statusOf(step.id)}
        data={data[step.id]}
        setData={b.setData}
        view={views[step.id] ?? {}}
        setView={b.setView}
        events={b.events}
      >
        {acc}
      </step.Provider>
    );
  }, children);
}

/** Écran d'entrée : saisie du sujet. */
function SubjectForm({ onSubmit, onImport, notice, fullscreen }) {
  const [value, setValue] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const subject = value.trim();
    if (subject) onSubmit(subject);
  };

  return (
    <form className="dissertation-intro" onSubmit={submit}>
      <span className="eyebrow">Dissertation</span>
      <h1>Quel est votre sujet ?</h1>
      <textarea
        autoFocus
        rows={3}
        value={value}
        placeholder="Ex. : Peut-on être heureux sans être libre ?"
        aria-label="Sujet de la dissertation"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) submit(e);
        }}
      />
      <div className="dissertation-intro-actions">
        <button type="submit" className="dissertation-validate" disabled={!value.trim()}>
          Valider le sujet
        </button>
        <button
          type="button"
          className="dissertation-io-btn"
          onClick={onImport}
          aria-label="Importer un travail (fichier exporté)"
          title="Importer un travail (fichier exporté)"
        >
          <IoIcon kind="import" />
        </button>
      </div>
      {notice && (
        <p className={`dissertation-notice is-${notice.tone}`} role="status">
          {notice.text}
        </p>
      )}
      {fullscreen.supported && (
        <p className="dissertation-fs-hint">
          <button type="button" className="dissertation-fs-hint-btn" onClick={fullscreen.toggle}>
            {fullscreen.isFullscreen ? "Quitter le plein écran" : "Passer en plein écran"}
          </button>
        </p>
      )}
      <Link to="/" className="dissertation-back">
        ← Retour à l’accueil
      </Link>
    </form>
  );
}

function Editor() {
  const rf = useReactFlow();
  const fullscreen = useFullscreen();
  const [boot] = useState(bootState);
  const [subject, setSubject] = useState(boot.subject);
  const [data, setData] = useState(boot.data);
  const [views, setViews] = useState({});
  const [validated, setValidated] = useState(boot.validated);
  const [active, setActive] = useState(boot.active); // étape modifiable ; null = tout est validé
  const [ui, setUi] = useState(boot.ui); // { [nodeId]: { position, measured, selected, dragging } }
  const [error, setError] = useState(null); // { stepId, snapshot, message }
  const [notice, setNotice] = useState(null); // { tone: "ok" | "error", text } (export, import, sauvegarde)
  const [author, setAuthor] = useState(boot.author); // { firstName, lastName }, retenu d'un export à l'autre
  const [exporting, setExporting] = useState(false); // fenêtre d'export ouverte
  const fileInput = useRef(null);
  const [toolId, setToolId] = useState(null);

  const registry = useRef(new Map()); // étape -> ref de ses gestionnaires d'événements
  const dragged = useRef(false);
  const lastPaneTap = useRef(null);

  /* ---------- États des étapes ---------- */

  const statusOf = useCallback(
    (id) => (id === active ? "current" : validated.includes(id) ? "done" : "locked"),
    [active, validated]
  );
  const firstOpen = steps.find((s) => !validated.includes(s.id))?.id ?? null;
  const reachable = useMemo(
    () => steps.map((s) => s.id).filter((id) => validated.includes(id) || id === firstOpen),
    [validated, firstOpen]
  );

  /* ---------- Carte ---------- */

  const topics = useMemo(() => buildTopics(data, subject ?? ""), [data, subject]);
  const derived = useMemo(
    () => (subject === null ? { nodes: [], edges: [] } : buildCanvas(subject, data, views, topics)),
    [subject, data, views, topics]
  );
  const graph = useMemo(() => makeGraph(derived.nodes), [derived]);
  const nodes = useMemo(
    () =>
      derived.nodes.map((n) => {
        const u = ui[n.id];
        return u ? { ...n, ...u, position: u.position ?? n.position } : n;
      }),
    [derived, ui]
  );
  const onNodesChange = useCallback((changes) => setUi((prev) => applyUiChanges(prev, changes)), []);

  /* ---------- API des étapes ---------- */

  const api = useMemo(
    () => ({
      getNode: (id) => rf.getNode(id) ?? null,
      getNodes: () => rf.getNodes(),
      screenToFlowPosition: (p) => rf.screenToFlowPosition(p),
      nodeAnchor: (id) => {
        const el = document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
        return el ? rectAnchor(el) : null;
      },
      viewportCenter: () => {
        const x = window.innerWidth / 2;
        const y = window.innerHeight / 2;
        return { anchor: pointAnchor(x, y), position: rf.screenToFlowPosition({ x, y }) };
      },
    }),
    [rf]
  );

  const workspace = useMemo(() => ({ subject: subject ?? "", topics, graph, api }), [subject, topics, graph, api]);

  // Par étape : setData / setView limités à ses données, et l'abonnement aux événements du canevas.
  const binders = useMemo(
    () =>
      Object.fromEntries(
        steps.map((s) => [
          s.id,
          {
            setData: (upd) =>
              setData((d) => ({ ...d, [s.id]: typeof upd === "function" ? upd(d[s.id]) : upd })),
            setView: (patch) => setViews((v) => ({ ...v, [s.id]: { ...v[s.id], ...patch } })),
            events: {
              bind: (ref) => {
                registry.current.set(s.id, ref);
                return () => {
                  if (registry.current.get(s.id) === ref) registry.current.delete(s.id);
                };
              },
            },
          },
        ])
      ),
    []
  );

  /* ---------- Événements du canevas → étapes ---------- */

  const call = (stepId, kind, payload) => registry.current.get(stepId)?.current?.[kind]?.(payload) === true;
  // Étape en cours d'abord, puis l'étape propriétaire de l'élément (lecture seule, par exemple).
  const dispatch = (kind, payload, owner) => {
    if (active && call(active, kind, payload)) return;
    if (owner && owner !== active) call(owner, kind, payload);
  };

  const onNodeClick = (e, node) => {
    if (dragged.current) {
      dragged.current = false; // fin d'un déplacement, pas un clic
      return;
    }
    // Les boutons, champs et zones .nodrag à l'intérieur d'un nœud gèrent leurs propres clics.
    if (e.target.closest?.("button, a, input, textarea, select, .nodrag")) return;
    const el = e.target.closest?.(".react-flow__node");
    dispatch("onNodeClick", { node, anchor: el ? rectAnchor(el) : pointAnchor(e.clientX, e.clientY) }, node.data?.owner);
  };

  const onEdgeClick = (e, edge) => {
    if (!edge.data?.clickable) return;
    dispatch("onEdgeClick", { edge, anchor: pointAnchor(e.clientX, e.clientY) }, edge.data.owner);
  };

  const onPaneClick = (e) => {
    const now = Date.now();
    const last = lastPaneTap.current;
    const isDouble =
      !!last && now - last.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_TAP_PX;
    lastPaneTap.current = isDouble ? null : { t: now, x: e.clientX, y: e.clientY };
    if (!active) return;
    call(active, "onPaneClick", {});
    if (isDouble) {
      call(active, "onPaneDoubleClick", {
        anchor: pointAnchor(e.clientX, e.clientY),
        position: rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      });
    }
  };

  // Clavier : Entrée ou Espace sur un nœud (focalisable par Tab) = clic.
  const onCanvasKeyDown = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target;
    if (!el.classList?.contains("react-flow__node")) return;
    const node = rf.getNode(el.dataset.id);
    if (!node) return;
    e.preventDefault();
    dispatch("onNodeClick", { node, anchor: rectAnchor(el) }, node.data?.owner);
  };

  /* ---------- Navigation et validation ---------- */

  const stepById = (id) => steps.find((s) => s.id === id);
  const validateStep = (id) => stepById(id)?.validate?.(data[id], graph) ?? null;
  const fail = (stepId, message) => setError({ stepId, snapshot: data[stepId], message });

  // Étapes validées qui ne passent plus leur validation (ex. élément supprimé en amont).
  const warnings = validated.filter((id) => validateStep(id));

  const goTo = (id) => {
    if (id === active || !reachable.includes(id)) return;
    if (active && validated.includes(active)) {
      const message = validateStep(active);
      if (message) return fail(active, `${message} Corrigez cette étape avant d'en changer.`);
    }
    setError(null);
    setViews({}); // état d'affichage transitoire (nœud choisi, menu ouvert…) : remis à zéro
    setActive(id);
  };

  const validateActive = () => {
    if (!active) return;
    const message = validateStep(active);
    if (message) return fail(active, message);
    setError(null);
    const next = validated.includes(active) ? validated : [...validated, active];
    setValidated(next);
    setViews({});
    setActive(steps.find((s) => !next.includes(s.id))?.id ?? null);
  };

  // L'erreur disparaît dès que les données de l'étape changent.
  const shownError = error && error.stepId === active && error.snapshot === data[active] ? error.message : null;

  /* ---------- Sauvegarde, export, import ---------- */

  // Sauvegarde automatique dans le navigateur, peu après chaque modification.
  useEffect(() => {
    if (subject === null) return;
    const t = setTimeout(() => {
      const ok = saveToStorage(makeSnapshot({ subject, data, validated, active, ui, author }));
      if (!ok) setNotice({ tone: "error", text: "Sauvegarde du navigateur impossible : pensez à exporter votre travail." });
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [subject, data, validated, active, ui, author]);

  // Les confirmations disparaissent seules ; les erreurs restent jusqu'à la prochaine action.
  useEffect(() => {
    if (notice?.tone !== "ok") return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  /** Export après saisie du prénom et du nom : fichier nom_prenom_dissertation.html. */
  const exportHtml = async (who) => {
    setAuthor(who);
    setExporting(false);
    const snapshot = makeSnapshot({ subject, data, validated, active, ui, author: who });
    const divider = await loadDividerDataUrl(); // ornement du site, embarqué ; null → trait simple
    const html = buildPosterHtml({ subject, topics, describe: graph.describe, snapshot, author: who, divider });
    downloadText(exportFileName(who), html);
    setNotice({ tone: "ok", text: "Export téléchargé." });
  };

  const importFile = async (file) => {
    try {
      const restored = restoreSnapshot(await readSnapshotFile(file), steps);
      if (!restored) throw new Error("Ce fichier ne contient pas de dissertation exportée.");
      if (subject !== null && !window.confirm("Remplacer le travail en cours par celui du fichier importé ?")) return;
      setSubject(restored.subject);
      setData(restored.data);
      setValidated(restored.validated);
      setActive(restored.active);
      setUi(restored.ui);
      setAuthor(restored.author);
      setViews({});
      setError(null);
      setNotice({ tone: "ok", text: "Travail importé : toutes les étapes peuvent être reprises." });
      setTimeout(() => rf.fitView({ maxZoom: 1, padding: 0.5 }), 100); // recadre une fois les nœuds mesurés
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof SyntaxError ? "Fichier illisible." : e.message });
    }
  };

  const openImport = () => fileInput.current?.click();

  /** Retour à l'écran du sujet : le travail en cours est effacé (après confirmation). */
  const goHome = () => {
    const ok = window.confirm(
      "Revenir à la saisie du sujet ?\n\nLe travail en cours sera effacé de ce navigateur. " +
        "Exportez-le d’abord si vous voulez le conserver."
    );
    if (!ok) return;
    clearStorage();
    setSubject(null);
    setData(initialData());
    setValidated([]);
    setActive(steps[0]?.id ?? null);
    setUi({});
    setViews({});
    setError(null);
    setNotice(null);
    setToolId(null);
    setExporting(false);
    // l'auteur est conservé : il resservira au prochain export
  };

  const ActiveTool = useMemo(
    () => (toolId ? steps.flatMap((s) => s.tools).find((t) => t.id === toolId)?.Component ?? null : null),
    [toolId]
  );

  return (
    <div className="dissertation-editor">
      {fullscreen.supported && (
        <button
          type="button"
          className="dissertation-fullscreen"
          onClick={fullscreen.toggle}
          aria-label={fullscreen.isFullscreen ? "Quitter le plein écran" : "Passer en plein écran"}
          title={fullscreen.isFullscreen ? "Quitter le plein écran" : "Plein écran"}
        >
          <FullscreenIcon exit={fullscreen.isFullscreen} />
        </button>
      )}

      <input
        ref={fileInput}
        type="file"
        accept=".html,.htm,.json,text/html,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // permet de réimporter le même fichier
          if (file) importFile(file);
        }}
      />

      {subject === null ? (
        <SubjectForm onSubmit={setSubject} onImport={openImport} notice={notice} fullscreen={fullscreen} />
      ) : (
        <WorkspaceContext.Provider value={workspace}>
          <StepProviders statusOf={statusOf} data={data} views={views} binders={binders}>
            <>
              <div
                className="dissertation-canvas"
                onPointerDownCapture={() => {
                  dragged.current = false;
                }}
                onKeyDown={onCanvasKeyDown}
              >
                <ReactFlow
                  nodes={nodes}
                  edges={derived.edges}
                  onNodesChange={onNodesChange}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onNodeClick={onNodeClick}
                  onEdgeClick={onEdgeClick}
                  onPaneClick={onPaneClick}
                  onNodeDragStart={() => {
                    dragged.current = true;
                  }}
                  deleteKeyCode={null} // le contenu appartient aux étapes : pas de suppression au clavier
                  zoomOnDoubleClick={false} // le double-clic dans le vide est transmis aux étapes
                  fitView
                  fitViewOptions={{ maxZoom: 1, padding: 0.5 }}
                  minZoom={0.1}
                  maxZoom={3}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background gap={28} size={1.5} color="#d9cfc2" />
                  <Controls showInteractive={false} position="bottom-right" />
                </ReactFlow>
              </div>

              <StepPanel
                active={active}
                validated={validated}
                reachable={reachable}
                warnings={warnings}
                onSelect={goTo}
                onValidate={validateActive}
                onOpenTool={setToolId}
                onExport={() => setExporting(true)}
                onImport={openImport}
                onHome={goHome}
                notice={notice}
                error={shownError}
              />

              {ActiveTool && <ActiveTool subject={subject} onClose={() => setToolId(null)} />}

              {exporting && (
                <ExportDialog author={author} onConfirm={exportHtml} onCancel={() => setExporting(false)} />
              )}
            </>
          </StepProviders>
        </WorkspaceContext.Provider>
      )}
    </div>
  );
}

export default function DissertationEditor() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
