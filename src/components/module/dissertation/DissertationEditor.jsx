import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ReactFlow, ReactFlowProvider, Background, Controls, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./dissertation.css";
import StepPanel, { WIDE_QUERY, useWide } from "./StepPanel";
import ExportDialog from "./ExportDialog";
import steps from "./stepRegistry";
import { useFullscreen } from "../../../lib/useFullscreen";
import { useVisibleViewport } from "../../../lib/useVisibleViewport";
import { WorkspaceContext } from "./lib/workspace";
import { StepInfoContext } from "./lib/HintBar";
import { SUBJECT_ID, NODE_Z, EDGE_Z } from "./lib/canvas";
import { rectAnchor, pointAnchor } from "./lib/anchor";
import NodeHandles from "./lib/NodeHandles";
import FloatingEdge from "./lib/FloatingEdge";
import { IoIcon, ArrowIcon, EyeIcon, ChevronIcon } from "./lib/icons";
import { useExamples, loadExample } from "./lib/examples";
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

/** Écran d'entrée : saisie du sujet, aperçu du parcours, exemples terminés. */
function SubjectForm({ onSubmit, onImport, notice, examples, onOpenExample }) {
  const [value, setValue] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const subject = value.trim();
    if (subject) onSubmit(subject);
  };

  return (
    <div className="dissertation-intro-page">
      <Link to="/" className="dissertation-back">
        <ChevronIcon dir="left" />
        Retour au cours
      </Link>

      <form className="dissertation-intro" onSubmit={submit}>
        <div className="dissertation-intro-head">
          <span className="eyebrow">Dissertation</span>
          <h1>Quel est votre sujet ?</h1>
          <p>Recopiez le sujet exactement comme il est donné.</p>
        </div>
        <textarea
          autoFocus
          rows={2}
          value={value}
          placeholder="Ex. : Peut-on être heureux sans être libre ?"
          aria-label="Sujet de la dissertation"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
        />
        <div className="dissertation-intro-actions">
          <button type="submit" className="dissertation-validate is-primary" disabled={!value.trim()}>
            Commencer
            <ArrowIcon />
          </button>
          <button type="button" className="dissertation-pill" onClick={onImport} title="Ouvrir un fichier exporté depuis cet éditeur">
            <IoIcon kind="import" />
            Reprendre mon travail
          </button>
        </div>
        {notice && (
          <p className={`dissertation-notice is-${notice.tone}`} role="status">
            {notice.text}
          </p>
        )}
      </form>

      <section className="dissertation-intro-steps" aria-labelledby="intro-steps-title">
        <h2 id="intro-steps-title">Le parcours en {steps.length} étapes</h2>
        <ol>
          {steps.map((s, i) => (
            <li key={s.id}>
              <span className="dissertation-intro-dot" aria-hidden="true">
                {i + 1}
              </span>
              <span className="dissertation-intro-step">{s.title}</span>
            </li>
          ))}
        </ol>
      </section>

      {examples.length > 0 && (
        <section className="dissertation-intro-examples" aria-labelledby="intro-ex-title">
          <div className="dissertation-intro-examples-head">
            <h2 id="intro-ex-title">Voir un exemple terminé</h2>
            <p>Ouvrez une dissertation complète pour voir le résultat attendu à chaque étape.</p>
          </div>
          <ul>
            {examples.map((ex) => (
              <li key={ex.file}>
                <button type="button" className="dissertation-example-card" onClick={() => onOpenExample(ex)}>
                  <span className="dissertation-example-thumb" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="dissertation-example-text">
                    <span className="dissertation-example-title">{ex.title}</span>
                    <span className="dissertation-example-open">Ouvrir l’exemple</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="dissertation-intro-foot">Votre travail reste dans ce navigateur. Exportez-le pour le rendre.</p>
    </div>
  );
}

function Editor() {
  const rf = useReactFlow();
  const fullscreen = useFullscreen();
  useVisibleViewport(); // clavier mobile : l'éditeur se cale sur la zone visible
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
  // Parcours ouvert : par défaut sur grand écran (colonne à gauche), fermé sur téléphone.
  const [railOpen, setRailOpen] = useState(() => !!window.matchMedia?.(WIDE_QUERY).matches);
  // Mode exemple (lecture seule) : { title, focus } ; le travail de l'élève est mis de côté dans savedWork.
  const [example, setExample] = useState(null);
  const savedWork = useRef(null);
  const examples = useExamples();
  const wide = useWide();

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
  const focus = example?.focus ?? null;
  const nodes = useMemo(
    () =>
      derived.nodes.map((n) => {
        const u = ui[n.id];
        const out = u ? { ...n, ...u, position: u.position ?? n.position } : n;
        // Mode exemple, une étape choisie : ce qui n'appartient pas à cette étape est estompé.
        if (focus && n.id !== SUBJECT_ID && n.data?.owner !== focus) {
          return { ...out, className: `${out.className ?? ""} is-dimmed`.trim() };
        }
        return out;
      }),
    [derived, ui, focus]
  );
  const edges = useMemo(
    () =>
      focus
        ? derived.edges.map((e) => (e.data?.owner === focus ? e : { ...e, className: `${e.className ?? ""} is-dimmed`.trim() }))
        : derived.edges,
    [derived, focus]
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
    if (subject === null || example) return; // un exemple ouvert n'est jamais enregistré
    const t = setTimeout(() => {
      const ok = saveToStorage(makeSnapshot({ subject, data, validated, active, ui, author }));
      if (!ok) setNotice({ tone: "error", text: "Sauvegarde du navigateur impossible : pensez à exporter votre travail." });
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [subject, data, validated, active, ui, author, example]);

  // Les confirmations disparaissent seules ; les erreurs restent jusqu'à la prochaine action.
  useEffect(() => {
    if (notice?.tone !== "ok") return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  /** Export après saisie du prénom et du nom : fichier nom_prenom_dissertation.html. */
  /** HTML du poster pour le travail affiché (export, ou aperçu sans bouton « Reprendre dans l'éditeur »). */
  const makePoster = async (who, { preview = false } = {}) => {
    const snapshot = makeSnapshot({ subject, data, validated, active, ui, author: who });
    const divider = await loadDividerDataUrl(); // ornement du site, embarqué ; null → trait simple
    // Numéro de l'étape qui publie chaque topic (pastilles 1 à 7 du poster).
    const numbers = {};
    steps.forEach((st, i) => Object.keys(st.provides ?? {}).forEach((t) => (numbers[t] = i + 1)));
    const editorUrl = preview ? null : `${window.location.origin}${import.meta.env.BASE_URL}dissertation`;
    return buildPosterHtml({ subject, topics, describe: graph.describe, snapshot, author: who, divider, numbers, editorUrl });
  };

  /** Aperçu du poster par-dessus la carte : dans l'éditeur comme dans un exemple. */
  const [posterHtml, setPosterHtml] = useState(null);
  const openPoster = async () => {
    setRailOpen((o) => (wide ? o : false));
    setPosterHtml(await makePoster(example ? example.author : author, { preview: true }));
  };

  const exportHtml = async (who) => {
    setAuthor(who);
    setExporting(false);
    const html = await makePoster(who);
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

  /* ---------- Exemples (lecture seule) ---------- */

  /** Ouvre un exemple terminé : le travail en cours est mis de côté (pas effacé) le temps de la lecture. */
  const openExample = async (ex) => {
    try {
      const restored = restoreSnapshot(await loadExample(ex.file), steps);
      if (!restored) throw new Error("Cet exemple ne contient pas de dissertation lisible.");
      savedWork.current = { subject, data, validated, active, ui, author };
      setSubject(restored.subject);
      setData(restored.data);
      setValidated(steps.map((st) => st.id)); // tout est lisible, rien n'est modifiable
      setActive(null);
      setUi(restored.ui);
      setViews({});
      setError(null);
      setNotice(null);
      setExample({ title: ex.title, focus: null, author: restored.author });
      setTimeout(() => rf.fitView({ maxZoom: 1, padding: 0.4 }), 100);
    } catch (e) {
      setNotice({ tone: "error", text: e.message || "Impossible d’ouvrir cet exemple." });
    }
  };

  /** Referme l'exemple et rend à l'élève son travail exactement comme il l'avait laissé. */
  const quitExample = () => {
    const w = savedWork.current;
    savedWork.current = null;
    setExample(null);
    setViews({});
    if (!w) return;
    setSubject(w.subject);
    setData(w.data);
    setValidated(w.validated);
    setActive(w.active);
    setUi(w.ui);
    setAuthor(w.author);
    setTimeout(() => rf.fitView({ maxZoom: 1, padding: 0.5 }), 100);
  };

  const setExampleFocus = (id) => setExample((x) => (x ? { ...x, focus: x.focus === id ? null : id } : x));

  // Mode exemple : la vue suit l'étape mise en avant.
  useEffect(() => {
    if (!example) return;
    const ids = example.focus ? derived.nodes.filter((n) => n.data?.owner === example.focus).map((n) => ({ id: n.id })) : undefined;
    const t = setTimeout(() => rf.fitView({ nodes: ids?.length ? ids : undefined, maxZoom: 1, padding: 0.5, duration: 400 }), 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [example?.focus]);

  const recenter = () => rf.fitView({ maxZoom: 1, padding: 0.5, duration: 300 });

  const ActiveTool = useMemo(
    () => (toolId ? steps.flatMap((s) => s.tools).find((t) => t.id === toolId)?.Component ?? null : null),
    [toolId]
  );

  const activeIndex = steps.findIndex((st) => st.id === active);
  const stepInfo = useMemo(
    () => (activeIndex >= 0 && !example ? { index: activeIndex + 1, total: steps.length } : null),
    [activeIndex, example]
  );
  const readiness = active && !example ? validateStep(active) : null;
  const wideRail = railOpen && subject !== null && wide;

  const classes = [
    "dissertation-editor",
    subject === null && "is-intro",
    wideRail && "has-rail",
    example && "is-example",
  ].filter(Boolean);

  return (
    <div className={classes.join(" ")}>
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
        <SubjectForm
          onSubmit={setSubject}
          onImport={openImport}
          notice={notice}
          examples={examples}
          onOpenExample={openExample}
        />
      ) : (
        <WorkspaceContext.Provider value={workspace}>
          <StepInfoContext.Provider value={stepInfo}>
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
                    edges={edges}
                    onNodesChange={onNodesChange}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodeClick={onNodeClick}
                    onEdgeClick={onEdgeClick}
                    onPaneClick={onPaneClick}
                    onNodeDragStart={() => {
                      dragged.current = true;
                    }}
                    nodesDraggable={!example}
                    deleteKeyCode={null} // le contenu appartient aux étapes : pas de suppression au clavier
                    zoomOnDoubleClick={false} // le double-clic dans le vide est transmis aux étapes
                    fitView
                    fitViewOptions={{ maxZoom: 1, padding: 0.5 }}
                    minZoom={0.1}
                    maxZoom={3}
                    proOptions={{ hideAttribution: true }}
                  >
                    <Background gap={28} size={1.5} color="#e0d6ca" />
                    <Controls showInteractive={false} position="bottom-right" />
                  </ReactFlow>
                </div>

                {example && (
                  <ExampleBanner
                    title={example.title}
                    focus={example.focus}
                    onFocus={(id) => setExample((x) => (x ? { ...x, focus: id } : x))}
                    onQuit={quitExample}
                    onPoster={openPoster}
                  />
                )}

                <StepPanel
                  subject={subject}
                  active={active}
                  validated={validated}
                  reachable={reachable}
                  warnings={warnings}
                  readiness={readiness}
                  onSelect={goTo}
                  onValidate={validateActive}
                  onExport={() => setExporting(true)}
                  onImport={openImport}
                  onHome={goHome}
                  onRecenter={recenter}
                  onPoster={openPoster}
                  notice={notice}
                  error={shownError}
                  open={railOpen}
                  setOpen={setRailOpen}
                  example={example ? { focus: example.focus, setFocus: setExampleFocus } : null}
                />

                {posterHtml && <PosterPreview html={posterHtml} onClose={() => setPosterHtml(null)} />}

                {ActiveTool && <ActiveTool subject={subject} onClose={() => setToolId(null)} />}

                {exporting && (
                  <ExportDialog author={author} onConfirm={exportHtml} onCancel={() => setExporting(false)} />
                )}
              </>
            </StepProviders>
          </StepInfoContext.Provider>
        </WorkspaceContext.Provider>
      )}
    </div>
  );
}

/** Bandeau du mode exemple : lecture seule, navigation étape par étape, sortie. */
/**
 * Aperçu du poster, par-dessus l'éditeur : le vrai fichier exporté, affiché dans un cadre
 * (avec sa barre Poster / Lecture / Imprimer). Échap ou « Revenir à la carte » pour le fermer.
 */
function PosterPreview({ html, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="dissertation-poster-preview" role="dialog" aria-modal="true" aria-label="Aperçu du poster">
      <iframe title="Poster de la dissertation" srcDoc={html} />
      <button type="button" className="dissertation-pill dissertation-poster-close" onClick={onClose} autoFocus aria-label="Revenir à la carte">
        <ChevronIcon dir="left" />
        <span className="dissertation-pill-label">Revenir à la carte</span>
      </button>
    </div>
  );
}

function ExampleBanner({ title, focus, onFocus, onQuit, onPoster }) {
  const i = steps.findIndex((s) => s.id === focus);
  const prev = i > 0 ? steps[i - 1] : null;
  const next = i >= 0 ? steps[i + 1] ?? null : steps[0] ?? null;
  return (
    <>
      <div className="dissertation-example-banner" role="status">
        <span className="dissertation-example-tag">
          <EyeIcon />
          Exemple
        </span>
        <span className="dissertation-example-banner-text" title={title}>
          Lecture seule : rien n’est modifié ni enregistré.
        </span>
        <button type="button" className="dissertation-pill" onClick={onPoster} aria-label="Voir le poster de l’exemple">
          <EyeIcon />
          <span className="dissertation-pill-label">Poster</span>
        </button>
        <button type="button" className="dissertation-pill" onClick={onQuit}>
          Quitter l’exemple
        </button>
      </div>
      <div className="dissertation-example-nav">
        {prev && (
          <button type="button" className="dissertation-pill" onClick={() => onFocus(prev.id)}>
            <ChevronIcon dir="left" />
            {steps.indexOf(prev) + 1}. {prev.title}
          </button>
        )}
        {next && (
          <button type="button" className="dissertation-validate is-primary" onClick={() => onFocus(next.id)}>
            {steps.indexOf(next) + 1}. {next.title}
            <ArrowIcon />
          </button>
        )}
      </div>
    </>
  );
}

export default function DissertationEditor() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
