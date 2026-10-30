import { useState } from "react";
import { getPairs } from "./lib/overlayGeometry";
import { roman } from "./tools/mouvement";
import { locateInText } from "./ExplicationCard";

/**
 * Onglet « Plan » du panneau du bas : le plan de l'explication, construit automatiquement à partir
 * des mouvements (dans l'ordre du texte), avec pour chacun les concepts et exemples qu'il contient.
 * Lecture seule : on le corrige en modifiant les cartes des autres onglets.
 */

/** Éléments `tag` (concept, exemple) contenus entre les deux crochets d'un mouvement, un par groupe. */
function inside(container, tag, openEl, closeEl) {
  const range = document.createRange();
  range.setStartAfter(openEl);
  range.setEndBefore(closeEl);
  const seen = new Map();
  container.querySelectorAll(tag).forEach((el) => {
    if (!range.intersectsNode(el)) return;
    const id = el.dataset.id || el.textContent;
    if (!seen.has(id)) seen.set(id, { el, text: "" });
    seen.get(id).text += el.textContent;
  });
  return [...seen.values()].map((g) => ({ el: g.el, text: g.text.replace(/\s+/g, " ").trim() }));
}

const shorten = (t, n = 48) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t);

export default function PlanPanel({ containerRef }) {
  const [copied, setCopied] = useState(false);
  const container = containerRef.current;
  const parts = container
    ? getPairs(container).map((it, i) => ({
        num: roman(i + 1),
        it,
        title: it.openEl.getAttribute("label")?.trim() || "",
        desc: it.openEl.getAttribute("description")?.trim() || "",
        concepts: inside(container, "concept", it.openEl, it.closeEl),
        exemples: inside(container, "exemple", it.openEl, it.closeEl),
      }))
    : [];

  if (!parts.length) {
    return (
      <p className="explication-panel-empty">
        Le plan se construit tout seul à partir de vos mouvements : délimitez-les avec les crochets [ ].
      </p>
    );
  }

  const copy = async () => {
    const text = parts
      .map((p) => {
        const lines = [`${p.num}. ${p.title || "Mouvement sans titre"}`];
        if (p.desc) lines.push(`   ${p.desc}`);
        if (p.concepts.length) lines.push(`   Concepts : ${p.concepts.map((c) => c.text).join(", ")}`);
        if (p.exemples.length) lines.push(`   Exemples : ${p.exemples.map((c) => shorten(c.text)).join(" ; ")}`);
        return lines.join("\n");
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible : rien */
    }
  };

  return (
    <div className="explication-plan">
      <ol className="explication-plan-list">
        {parts.map((p) => (
          <li key={p.it.pid} className="explication-plan-part">
            <button type="button" className="explication-plan-title" onClick={() => locateInText(p.it.openEl)} title="Retrouver dans le texte">
              <span className="explication-plan-num">{p.num}.</span>
              <span>{p.title || <em>Mouvement sans titre</em>}</span>
            </button>
            {p.desc ? (
              <p className="explication-plan-desc">{p.desc}</p>
            ) : (
              <p className="explication-plan-desc is-missing">Ce mouvement n’a pas encore d’explication.</p>
            )}
            {(p.concepts.length > 0 || p.exemples.length > 0) && (
              <div className="explication-plan-chips">
                {p.concepts.map((c, i) => (
                  <button key={`c${i}`} type="button" className="explication-plan-chip is-concept" onClick={() => locateInText(c.el)}>
                    {c.text}
                  </button>
                ))}
                {p.exemples.map((c, i) => (
                  <button key={`e${i}`} type="button" className="explication-plan-chip is-exemple" onClick={() => locateInText(c.el)}>
                    Exemple : {shorten(c.text, 32)}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <button type="button" className="explication-pill" onClick={copy}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a1 1 0 0 1 1-1h10" />
        </svg>
        {copied ? "Plan copié" : "Copier le plan"}
      </button>
    </div>
  );
}
