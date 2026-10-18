import { useState } from "react";
import { useTopic, useWorkspace } from "./workspace";
import { CardRow } from "./Workspace";
import "./ui.css";

/**
 * Présentation des données publiées par les étapes (topics), réutilisable dans toutes les bulles.
 * Chaque composant ne dépend que du contrat du topic (voir stepRegistry.js), jamais du code d'une étape :
 * si aucune étape ne publie le topic, il n'affiche rien.
 */

const short = (t, n = 32) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t);

/** Libellé court d'un nœud relié (une connaissance sans titre est désignée par le début de son texte). */
export function useLinkLabel() {
  const { graph } = useWorkspace();
  return (id) => {
    const d = graph.describe(id);
    return d.kind === "connaissance" && !d.titled && d.text.trim() ? short(d.text.trim()) : d.label;
  };
}

/** Topic « definitions » : une pastille par mot ; une pastille ouverte montre ses définitions et définitions liées. */
export function DefinitionsMaterial() {
  const definitions = useTopic("definitions");
  const [openKey, setOpenKey] = useState(null);
  if (!definitions) return null;
  if (definitions.length === 0) return <p className="dissertation-tools-empty">Aucune définition rédigée.</p>;

  const open = definitions.find((d) => d.key === openKey);
  const cards = open
    ? open.entries.flatMap((e) => [
        { id: e.id, title: e.title !== open.word ? e.title : undefined, note: e.note, text: e.text },
        ...e.related.map((r) => ({ id: r.id, note: `Liée : ${r.word}`, text: r.text, linked: true })),
      ])
    : [];

  return (
    <>
      <div className="dissertation-chips dissertation-chiprow">
        {definitions.map((d) => (
          <button
            key={d.key}
            type="button"
            className={`dissertation-chip${openKey === d.key ? " is-active" : ""}`}
            aria-expanded={openKey === d.key}
            onClick={() => setOpenKey((k) => (k === d.key ? null : d.key))}
          >
            {d.word}
            {d.entries.length > 1 ? ` (${d.entries.length})` : ""}
          </button>
        ))}
      </div>
      <CardRow cards={cards} />
    </>
  );
}

/** Topic « contradictions » : « A ⟷ B » puis le commentaire. */
export function ContradictionsMaterial() {
  const contradictions = useTopic("contradictions");
  const label = useLinkLabel();
  if (!contradictions) return null;
  return (
    <CardRow
      empty="Aucune contradiction."
      cards={contradictions.map((c) => ({
        id: c.id,
        tone: "contradiction",
        // Titre personnalisé s'il existe, les deux éléments reliés en dessous.
        title: c.title || `${label(c.a)} ⟷ ${label(c.b)}`,
        note: c.title ? `${label(c.a)} ⟷ ${label(c.b)}` : undefined,
        text: c.text,
        empty: "Sans commentaire",
      }))}
    />
  );
}

/**
 * Topic « connaissances » : le texte, puis les nœuds reliés.
 * Avec `isActive` / `onToggle`, les cartes deviennent des boutons (ex. mobiliser dans une partie du plan),
 * et `footer(item)` permet d'ajouter un contenu sous chaque carte.
 */
export function KnowledgeMaterial({ isActive, onToggle, footer }) {
  const knowledge = useTopic("connaissances");
  const label = useLinkLabel();
  if (!knowledge) return null;
  return (
    <CardRow
      empty="Aucune connaissance."
      cards={knowledge.map((k) => ({
        id: k.id,
        tone: "knowledge",
        title: k.title || undefined,
        text: k.text,
        active: isActive?.(k.id),
        onClick: onToggle ? () => onToggle(k.id) : undefined,
        footer: (
          <>
            {k.links.length > 0 && (
              <span className="dissertation-card-links">Reliée à : {k.links.map(label).join(", ")}</span>
            )}
            {footer?.(k)}
          </>
        ),
      }))}
    />
  );
}
