import { DATA_ELEMENT_ID, embedJson } from "./persistence";

/**
 * Fichier HTML autonome exporté : ouvert seul, il affiche un poster qui tient entièrement à l'écran
 * (mis à l'échelle, sans défilement) ; il contient aussi la sauvegarde complète (JSON), que le bouton
 * « Importer » de l'éditeur relit pour reprendre le travail.
 *
 * Mise en page sobre : pas d'encadrés ni de fonds, la hiérarchie vient de la typographie et des espaces.
 * Le poster ne lit que les topics publiés par les étapes (voir stepRegistry.js) : une étape absente
 * fait simplement disparaître sa section.
 */

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Texte avec retours à la ligne conservés, ou mention en italique s'il est vide. */
const txt = (s, empty = "—") => {
  const t = String(s ?? "").trim();
  return t ? `<p>${esc(t)}</p>` : `<p class="empty">${esc(empty)}</p>`;
};

/** Ornement (data URL de lib/divider.js) ou, à défaut, trait simple. */
const ornament = (divider, cls) =>
  divider
    ? `<div class="divider ${cls}" aria-hidden="true"><img src="${divider}" alt=""></div>`
    : `<div class="divider ${cls} is-line" aria-hidden="true"></div>`;

/** « Prénom NOM ». */
export const authorName = (author) =>
  [author?.firstName?.trim(), author?.lastName?.trim().toLocaleUpperCase("fr")].filter(Boolean).join(" ");

const short = (t, n = 40) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t);

function section(title, body, cls = "") {
  return body ? `<section class="block ${cls}"><h2>${esc(title)}</h2>${body}</section>` : "";
}

function definitionsHtml(definitions) {
  if (!definitions) return "";
  if (!definitions.length) return section("Définitions", `<p class="empty">Aucune définition.</p>`, "defs");
  const cards = definitions
    .flatMap((d) =>
      d.entries.map(
        (e) => `<article class="item">
  <h3>${esc(e.title || d.word)}${e.title && e.title !== d.word ? ` <small>lié à « ${esc(d.word)} »</small>` : ""}</h3>
  ${txt(e.text)}
  ${e.note ? `<p class="note">${esc(e.note)}</p>` : ""}
  ${e.related
    .map((r) => `<p class="related"><strong>${esc(r.word)}</strong> — ${esc(r.text)}</p>`)
    .join("")}
</article>`
      )
    )
    .join("");
  return section("Définitions", cards, "defs");
}

function knowledgeHtml(knowledge, labelOf) {
  if (!knowledge) return "";
  const cards = knowledge.length
    ? knowledge
        .map(
          (k) => `<article class="item know${k.title ? "" : " untitled"}">
  ${k.title ? `<h3>${esc(k.title)}</h3>` : ""}
  ${txt(k.text)}
  ${k.links.length ? `<p class="links">Reliée à : ${k.links.map((id) => esc(labelOf(id))).join(", ")}</p>` : ""}
</article>`
        )
        .join("")
    : `<p class="empty">Aucune connaissance.</p>`;
  return section("Connaissances", cards, "knowledge");
}

function contradictionsHtml(contradictions, labelOf) {
  if (!contradictions) return "";
  const cards = contradictions.length
    ? contradictions
        .map((c) => {
          const ends = `${labelOf(c.a)} ⟷ ${labelOf(c.b)}`;
          return `<article class="item contra">
  <h3>${esc(c.title || ends)}</h3>
  ${c.title ? `<p class="note">${esc(ends)}</p>` : ""}
  ${txt(c.text, "Sans commentaire")}
</article>`;
        })
        .join("")
    : `<p class="empty">Aucune contradiction.</p>`;
  return section("Contradictions", cards, "contradictions");
}

function planHtml(plan, knowledge, divider) {
  if (!plan) return "";
  const knowLabel = (kid) => {
    const k = knowledge?.find((x) => x.id === kid);
    return k ? k.title || short(k.text.trim()) : null;
  };
  const parts = plan
    .map((p) => {
      const uses = p.knowledge.map(knowLabel).filter(Boolean);
      return `<article class="part">
  <h3>${esc(p.num)}. ${esc(p.title)}</h3>
  ${p.fields.map((f) => `<div class="field"><span>${esc(f.label)}</span>${txt(f.text)}</div>`).join("")}
  ${uses.length ? `<p class="uses">Connaissances : ${uses.map(esc).join(" · ")}</p>` : ""}
</article>`;
    })
    .join(ornament(divider, "in-plan"));
  return `<div class="rule" aria-hidden="true"></div><aside class="plan"><h2>Plan</h2>${parts}</aside>`;
}

const STYLE = `
*{box-sizing:border-box}
html,body{margin:0;height:100%;overflow:hidden;background:#f7f1ea;color:#3a2a1d}
body{font-family:"Helvetica Neue",Arial,sans-serif}
.poster{position:absolute;top:0;left:0;transform-origin:0 0;padding:56px;display:grid;grid-template-columns:minmax(0,1.9fr) 1px minmax(0,1fr);column-gap:56px;row-gap:28px}
.poster.no-plan{grid-template-columns:minmax(0,1fr)}
.subject,.reform,.lead p,h2,.item h3,.part h3{font-family:Georgia,"Iowan Old Style","Palatino Linotype",serif}
.main{display:flex;flex-direction:column;gap:28px;min-width:0}

/* En-tête centré : sujet, reformulation, problématique, thèse */
.head{display:flex;flex-direction:column;align-items:center;gap:22px;text-align:center}
.subject{margin:0;font-size:40px;line-height:1.25}
.reform{margin:-14px 0 0;font-size:19px;line-height:1.4;opacity:.55}
.lead{max-width:880px}
.lead h3{margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#8a7566}
.lead p{margin:0;font-size:23px;line-height:1.45;white-space:pre-wrap}
.lead.thesis p{color:#664930}

/* Ornement : le fond blanc de l'image disparaît sur le beige (multiply) */
.divider{display:flex;justify-content:center;align-self:center;width:100%}
.divider img{display:block;width:100%;height:auto;mix-blend-mode:multiply;opacity:.85}
.divider.under-head{max-width:380px}
.divider.in-plan{max-width:240px}
.divider.is-line{height:1px;background:linear-gradient(90deg,transparent,#c9b8a6,transparent)}

/* Trait vertical estompé entre la colonne principale et le plan */
.rule{background:linear-gradient(180deg,transparent,#d9cbbb 15%,#d9cbbb 85%,transparent)}
.no-plan .rule{display:none}

/* Catégories : titres plus grands que leurs éléments */
h2{margin:0;font-size:30px;font-weight:400;line-height:1.2;color:#3a2a1d}
.columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:48px;align-items:start}
.side{display:flex;flex-direction:column;gap:40px;min-width:0}
.block{display:flex;flex-direction:column;gap:0}
.block h2{margin-bottom:14px}
.item{padding:14px 0}
.item:first-of-type{padding-top:0}
.item+.item{border-top:1px solid #e3d7ca}
.item h3{margin:0 0 3px;font-size:20px;color:#664930}
.item h3 small{font-family:"Helvetica Neue",Arial,sans-serif;font-size:13px;font-weight:400;color:#8a7566}
.item p{margin:0;font-size:16px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
.item .note{margin-top:3px;font-size:13px;color:#8a7566}
.item .related{margin-top:6px;font-size:14px;color:#8a7566}
.item.know h3,.item.know .links{color:#2f6db5}
.item.know.untitled p:first-of-type::before{content:"●";margin-right:8px;font-size:11px;vertical-align:2px;color:#2f6db5}
.item.know .links{margin-top:4px;font-size:13px}
.item.contra h3{color:#c0392b}
.empty{font-style:italic;color:#8a7566}

/* Plan : parties à leur taille naturelle, réparties sur la hauteur, séparées par l'ornement */
.plan{display:flex;flex-direction:column;justify-content:space-between;gap:24px;min-width:0}
.part{display:flex;flex-direction:column;gap:10px}
.part h3{margin:0;font-size:24px;color:#664930}
.field span{display:block;margin-bottom:2px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a7566}
.field p{margin:0;font-size:16px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
.uses{margin:0;font-size:14px;color:#2f6db5}
.foot{grid-column:1/-1;margin:8px 0 0;text-align:center;font-size:13px;color:#8a7566}
`;

/**
 * Mise à l'échelle : on essaie plusieurs largeurs de mise en page et on garde celle qui permet
 * le plus grand agrandissement en tenant entièrement dans la fenêtre (pas de défilement).
 */
const FIT_SCRIPT = `
(function(){
  var p=document.getElementById("poster");
  function fit(){
    var vw=innerWidth,vh=innerHeight,best=null;
    p.style.transform="none";
    for(var w=900;w<=2600;w+=100){
      p.style.width=w+"px";
      var h=p.scrollHeight,s=Math.min(vw/w,vh/h)*0.98; /* marge de sécurité : rien n'est rogné */
      if(!best||s>best.s)best={w:w,h:h,s:s};
    }
    p.style.width=best.w+"px";
    p.style.left=Math.max(0,(vw-best.w*best.s)/2)+"px";
    p.style.top=Math.max(0,(vh-best.h*best.s)/2)+"px";
    p.style.transform="scale("+best.s+")";
  }
  addEventListener("resize",fit);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);
  fit();
})();
`;

/**
 * HTML autonome du poster.
 *   subject  : texte du sujet
 *   topics   : topics publiés par les étapes
 *   describe : graph.describe (libellés des nœuds reliés)
 *   snapshot : sauvegarde complète (lib/persistence.js), embarquée pour l'import
 *   author   : { firstName, lastName } (pied de page : « Prénom NOM · date »)
 *   divider  : data URL de l'ornement (lib/divider.js), ou null pour un trait simple
 */
export function buildPosterHtml({ subject, topics, describe, snapshot, author, divider = null }) {
  const labelOf = (id) => {
    const d = describe(id);
    return d.kind === "connaissance" && !d.titled && d.text.trim() ? short(d.text.trim()) : d.label;
  };
  const date = new Date(snapshot.savedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const lead = (cls, title, text) =>
    text?.trim() ? `<section class="lead ${cls}"><h3>${esc(title)}</h3><p>${esc(text.trim())}</p></section>` : "";

  const defs = definitionsHtml(topics.definitions);
  const side = knowledgeHtml(topics.connaissances, labelOf) + contradictionsHtml(topics.contradictions, labelOf);
  const columns = defs || side ? `<div class="columns"><div class="side">${defs}</div><div class="side">${side}</div></div>` : "";

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Philosite — dissertation">
<title>${esc(subject)}${authorName(author) ? ` — ${esc(authorName(author))}` : ""}</title>
<style>${STYLE}</style>
</head>
<body>
<main class="poster${topics.plan ? "" : " no-plan"}" id="poster">
  <div class="main">
    <header class="head">
      <h1 class="subject">${esc(subject)}</h1>
      ${topics.reformulation?.text?.trim() ? `<p class="reform">(${esc(topics.reformulation.text.trim())})</p>` : ""}
      ${lead("problem", "Problématique", topics.problematique?.text)}
      ${lead("thesis", "Thèse", topics.these?.text)}
    </header>
    ${columns ? ornament(divider, "under-head") + columns : ""}
  </div>
  ${planHtml(topics.plan, topics.connaissances, divider)}
  <p class="foot">${esc(authorName(author))}${authorName(author) ? " · " : ""}${esc(date)}</p>
</main>
<script type="application/json" id="${DATA_ELEMENT_ID}">${embedJson(snapshot)}</script>
<script>${FIT_SCRIPT}</script>
</body>
</html>
`;
}
