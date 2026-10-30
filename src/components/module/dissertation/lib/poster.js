import { DATA_ELEMENT_ID, embedJson } from "./persistence";

/**
 * Fichier HTML autonome exporté. Il contient aussi la sauvegarde complète (JSON), que le bouton
 * « Reprendre mon travail » de l'éditeur relit pour reprendre le travail.
 *
 * Deux affichages, au choix dans la petite barre du haut (cachée à l'impression) :
 *  - Poster : tout tient TOUJOURS dans l'écran, sans défilement (mise à l'échelle) ;
 *  - Lecture : une colonne qui défile, texte à taille normale, sommaire qui reste en haut.
 *    C'est l'affichage par défaut sur téléphone (un poster réduit y serait illisible) et à l'impression.
 *
 * Mise en page sobre : pas d'encadrés ni de fonds, la hiérarchie vient de la typographie et des espaces.
 * Chaque bloc porte le numéro de son étape, pour suivre la démarche dans l'ordre.
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
const txt = (s, empty = "Non rédigé.") => {
  const t = String(s ?? "").trim();
  return t ? `<p>${esc(t)}</p>` : `<p class="empty">${esc(empty)}</p>`;
};

/** Ornement (data URL de lib/divider.js) ou, à défaut, trait avec losange. */
const ornament = (divider, cls) =>
  divider
    ? `<div class="divider ${cls}" aria-hidden="true"><img src="${divider}" alt=""></div>`
    : `<div class="divider ${cls} is-line" aria-hidden="true"><i></i><b></b><i></i></div>`;

/** « Prénom NOM ». */
export const authorName = (author) =>
  [author?.firstName?.trim(), author?.lastName?.trim().toLocaleUpperCase("fr")].filter(Boolean).join(" ");

const short = (t, n = 40) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t);

/** Pastille du numéro d'étape (rien si l'étape n'est pas connue). */
const num = (n) => (n ? `<span class="n" aria-label="Étape ${n}">${n}</span>` : "");

function section(id, title, n, body, cls = "") {
  return body
    ? `<section class="block ${cls}" id="${id}" aria-labelledby="${id}-t"><h2 id="${id}-t">${num(n)}<span>${esc(title)}</span></h2>${body}</section>`
    : "";
}

function definitionsHtml(definitions, n) {
  if (!definitions) return "";
  if (!definitions.length) return section("definitions", "Définitions", n, `<p class="empty">Aucune définition.</p>`, "defs");
  const cards = definitions
    .flatMap((d) =>
      d.entries.map(
        (e) => `<article class="item">
  <h3>${esc(e.title || d.word)}${e.title && e.title !== d.word ? ` <small>lié à « ${esc(d.word)} »</small>` : ""}</h3>
  ${txt(e.text)}
  ${e.note ? `<p class="note">${esc(e.note)}</p>` : ""}
  ${e.related.map((r) => `<p class="related"><strong>${esc(r.word)}</strong> : ${esc(r.text)}</p>`).join("")}
</article>`
      )
    )
    .join("");
  return section("definitions", "Définitions", n, cards, "defs");
}

function knowledgeHtml(knowledge, labelOf, n) {
  if (!knowledge) return "";
  const cards = knowledge.length
    ? knowledge
        .map(
          (k) => `<article class="item know${k.title ? "" : " untitled"}">
  ${k.title ? `<h3>${esc(k.title)}</h3>` : ""}
  ${txt(k.text)}
  ${k.links.length ? `<p class="note">Reliée à : ${k.links.map((id) => esc(labelOf(id))).join(", ")}</p>` : ""}
</article>`
        )
        .join("")
    : `<p class="empty">Aucune connaissance.</p>`;
  return section("connaissances", "Connaissances", n, cards, "knowledge");
}

function contradictionsHtml(contradictions, labelOf, n) {
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
  return section("contradictions", "Contradictions", n, cards, "contradictions");
}

function planHtml(plan, knowledge, divider, n) {
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
  ${uses.length ? `<div class="field uses"><span>Connaissances</span><p>${uses.map(esc).join(" · ")}</p></div>` : ""}
</article>`;
    })
    .join(ornament(divider, "in-plan"));
  return `<div class="rule" aria-hidden="true"></div><aside class="plan" id="plan" aria-labelledby="plan-t"><h2 id="plan-t">${num(n)}<span>Plan</span></h2>${parts}</aside>`;
}

const STYLE = `
*{box-sizing:border-box}
html,body{margin:0;background:#f7f1ea;color:#3a2a1d}
body{font-family:"Helvetica Neue",Arial,sans-serif;-webkit-text-size-adjust:100%}
.subject,.reform,.lead p,h2,.item h3,.part h3{font-family:Georgia,"Iowan Old Style","Palatino Linotype",serif}

/* ---------- Barre d'actions (jamais imprimée) ---------- */
.bar{position:fixed;top:0;left:0;right:0;z-index:5;display:flex;justify-content:flex-end;align-items:center;gap:10px;padding:12px 16px;background:linear-gradient(#f7f1ea 70%,rgba(247,241,234,0))}
.bar .seg{display:flex;padding:4px;border-radius:999px;box-shadow:inset 3px 3px 6px #c9c5be,inset -3px -3px 6px #fff}
.bar button,.bar a{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 16px;border:0;border-radius:999px;background:#f7f1ea;color:#664930;font:600 14px "Helvetica Neue",Arial,sans-serif;text-decoration:none;cursor:pointer;box-shadow:3px 3px 7px #c9c5be,-3px -3px 7px #fff}
.bar .seg button{min-height:34px;padding:0 14px;box-shadow:none;background:transparent}
.bar .seg button[aria-pressed="true"]{background:#664930;color:#fff}
.bar button:focus-visible,.bar a:focus-visible{outline:2px solid #664930;outline-offset:2px}
.bar svg{display:block;flex:none}
@media (max-width:600px){.bar{gap:8px;padding:10px 12px}.bar .lbl{display:none}.bar>button,.bar>a{width:44px;padding:0;justify-content:center}}

/* ---------- Poster : tient entièrement dans l'écran ---------- */
body.mode-poster{height:100vh;overflow:hidden}
.mode-poster .poster{position:absolute;top:0;left:0;transform-origin:0 0;padding:44px 56px 36px;display:grid;grid-template-columns:minmax(0,1.85fr) 1px minmax(0,1fr);column-gap:52px;row-gap:24px}
.mode-poster .poster.no-plan{grid-template-columns:minmax(0,1fr)}
.main{display:flex;flex-direction:column;gap:26px;min-width:0}

.head{display:flex;flex-direction:column;gap:14px}
.byline{margin:0;font-size:15px;font-weight:600;color:#5a4637}
.subject{margin:0;font-size:42px;line-height:1.2}
.reform{margin:0;display:flex;gap:10px;align-items:baseline;font-size:20px;font-style:italic;line-height:1.45;color:#3a2a1d}
.reform .n{transform:translateY(4px)}
.leads{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px 40px}
.lead h3{display:flex;align-items:center;gap:8px;margin:0 0 6px;font-family:"Helvetica Neue",Arial,sans-serif;font-size:15px;font-weight:600;color:#5a4637}
.lead p{margin:0;font-size:21px;line-height:1.5;white-space:pre-wrap}
.lead.thesis p{color:#664930}

.n{display:inline-flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;border-radius:50%;border:1.5px solid #997e67;font:600 12px/1 "Helvetica Neue",Arial,sans-serif;font-style:normal;color:#664930}

/* Ornement : le fond blanc de l'image disparaît sur le beige (multiply) */
.divider{display:flex;justify-content:center;align-items:center;gap:10px;align-self:center;width:100%}
.divider img{display:block;width:100%;height:auto;mix-blend-mode:multiply;opacity:.85}
.divider.under-head{max-width:380px}
.divider.in-plan{max-width:240px}
.divider.is-line i{flex:1;height:1px;background:linear-gradient(90deg,transparent,#c9b8a6)}
.divider.is-line i+b+i{background:linear-gradient(90deg,#c9b8a6,transparent)}
.divider.is-line b{width:7px;height:7px;transform:rotate(45deg);border:1px solid #b9a690}

.rule{background:linear-gradient(180deg,transparent,#d9cbbb 12%,#d9cbbb 88%,transparent)}
.no-plan .rule{display:none}

h2{display:flex;align-items:center;gap:10px;margin:0;font-size:29px;font-weight:400;line-height:1.2;color:#3a2a1d}
.columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:44px;align-items:start}
.side{display:flex;flex-direction:column;gap:32px;min-width:0}
.block h2{margin-bottom:12px}
.item{padding:13px 0}
.item:first-of-type{padding-top:0}
.item+.item{border-top:1px solid #e3d7ca}
.item h3{margin:0 0 4px;font-size:20px;color:#664930}
.item h3 small{font-family:"Helvetica Neue",Arial,sans-serif;font-size:14px;font-weight:400;color:#5a4637}
.item p{margin:0;font-size:17px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
.item .note{margin-top:4px;font-size:15px;color:#5a4637}
.item .related{margin-top:6px;font-size:15px;color:#5a4637}
.item.know h3{color:#2a5f9e}
.item.know.untitled p:first-of-type::before{content:"";display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;vertical-align:2px;background:#2a5f9e}
.item.contra h3{color:#a8321f}
.empty{font-style:italic;color:#5a4637}

.plan{display:flex;flex-direction:column;justify-content:space-between;gap:20px;min-width:0}
.part{display:flex;flex-direction:column;gap:10px}
.part h3{margin:0;font-size:24px;color:#664930}
.field span{display:block;margin-bottom:2px;font-size:14px;font-weight:600;color:#5a4637}
.field p{margin:0;font-size:17px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
.field.uses p{color:#2a5f9e}
.toc{display:none}

/* ---------- Lecture : une colonne qui défile ---------- */
body.mode-lecture{overflow:auto}
.mode-lecture .poster{width:auto !important;max-width:760px;margin:0 auto;padding:12px 22px 48px;display:flex;flex-direction:column;gap:30px;transform:none !important;position:static}
.mode-lecture .main{display:contents}
.mode-lecture .head{order:0}
.mode-lecture .columns{display:contents}
.mode-lecture .side{display:contents}
.mode-lecture .rule{display:none}
.mode-lecture .subject{font-size:clamp(28px,7vw,40px)}
.mode-lecture .lead p{font-size:19px}
.mode-lecture .item p,.mode-lecture .field p{font-size:17px}
.mode-lecture h2{font-size:26px}
.mode-lecture .plan{gap:24px}
.mode-lecture .toc{display:flex;position:sticky;top:64px;z-index:4;gap:8px;margin:0 -22px;padding:8px 22px 12px;overflow-x:auto;scrollbar-width:none;background:#f7f1ea;border-bottom:1px solid #e3d7ca}
.toc::-webkit-scrollbar{display:none}
.toc a{flex:none;display:inline-flex;align-items:center;min-height:36px;padding:0 14px;border-radius:999px;background:#f7f1ea;color:#3a2a1d;font-size:14px;font-weight:500;text-decoration:none;box-shadow:2px 2px 5px #c9c5be,-2px -2px 5px #fff}
.toc a[aria-current="true"]{background:#664930;color:#fff}
.mode-lecture .poster{padding-top:68px}
.mode-lecture .block,.mode-lecture .plan,.mode-lecture #essentiel{scroll-margin-top:130px}
.foot{grid-column:1/-1;margin:6px 0 0;text-align:center;font-size:14px;color:#5a4637}

/* ---------- Impression : la lecture, sans la barre ---------- */
@media print{
  @page{size:A4;margin:16mm}
  .bar,.toc{display:none !important}
  html,body{height:auto !important;overflow:visible !important;background:#fff}
  .poster{position:static !important;transform:none !important;width:auto !important;max-width:none !important;padding:0 !important;display:block !important}
  .main,.columns,.side{display:block !important}
  .rule{display:none}
  .block,.plan,.head{margin-bottom:22px}
  .item,.part{break-inside:avoid}
  .subject{font-size:28px}
  .lead p{font-size:15px}
  .item p,.field p{font-size:12pt}
  h2{font-size:20px;margin-top:8px}
}
`;

/**
 * Affichage : poster mis à l'échelle (on essaie plusieurs largeurs de mise en page et on garde celle
 * qui permet le plus grand agrandissement en tenant ENTIÈREMENT sous la barre, sans défilement),
 * ou lecture en une colonne. Par défaut : lecture sur petit écran, poster ailleurs.
 */
const SCRIPT = `
(function(){
  var body=document.body,p=document.getElementById("poster"),bar=document.getElementById("bar");
  var btns=bar?bar.querySelectorAll("[data-mode]"):[];
  var KEY="poster-mode";
  function fit(){
    if(!body.classList.contains("mode-poster"))return;
    var top=(bar?bar.offsetHeight:0)+4,vw=innerWidth,vh=innerHeight-top,best=null;
    p.style.transform="none";
    for(var w=900;w<=2800;w+=100){
      p.style.width=w+"px";
      var h=p.scrollHeight,s=Math.min(vw/w,vh/h)*0.97; /* marge de sécurité : rien n'est rogné */
      if(!best||s>best.s)best={w:w,h:h,s:s};
    }
    p.style.width=best.w+"px";
    p.style.left=Math.max(0,(vw-best.w*best.s)/2)+"px";
    p.style.top=top+Math.max(0,(vh-best.h*best.s)/2)+"px";
    p.style.transform="scale("+best.s+")";
  }
  function setMode(m,save){
    body.classList.toggle("mode-poster",m==="poster");
    body.classList.toggle("mode-lecture",m==="lecture");
    for(var i=0;i<btns.length;i++)btns[i].setAttribute("aria-pressed",String(btns[i].getAttribute("data-mode")===m));
    if(m==="lecture"){p.style.width="";p.style.left="";p.style.top="";p.style.transform="";}
    if(save){try{sessionStorage.setItem(KEY,m)}catch(e){}}
    fit();
  }
  var saved=null;try{saved=sessionStorage.getItem(KEY)}catch(e){}
  setMode(saved||(innerWidth<760?"lecture":"poster"),false);
  for(var i=0;i<btns.length;i++)btns[i].addEventListener("click",function(){setMode(this.getAttribute("data-mode"),true)});
  var pr=document.getElementById("print");if(pr)pr.addEventListener("click",function(){window.print()});
  addEventListener("resize",fit);
  addEventListener("beforeprint",function(){p.style.transform="";p.style.width=""});
  addEventListener("afterprint",fit);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);
  /* Sommaire de la lecture : la section visible est mise en avant */
  var links=document.querySelectorAll(".toc a");
  if("IntersectionObserver" in window&&links.length){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;for(var j=0;j<links.length;j++)links[j].setAttribute("aria-current",String(links[j].getAttribute("href")==="#"+e.target.id));});},{rootMargin:"-40% 0px -55% 0px"});
    for(var k=0;k<links.length;k++){var t=document.getElementById(links[k].getAttribute("href").slice(1));if(t)io.observe(t);}
  }
})();
`;

const ICON_PRINT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/></svg>`;
const ICON_EDIT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

/**
 * HTML autonome du poster.
 *   subject   : texte du sujet
 *   topics    : topics publiés par les étapes
 *   describe  : graph.describe (libellés des nœuds reliés)
 *   snapshot  : sauvegarde complète (lib/persistence.js), embarquée pour l'import
 *   author    : { firstName, lastName } (« Prénom NOM · date »)
 *   divider   : data URL de l'ornement (lib/divider.js), ou null pour un trait simple
 *   numbers   : { [topic]: numéro de l'étape qui le publie } (pastilles 1 à 7)
 *   editorUrl : adresse de l'éditeur (bouton « Reprendre dans l'éditeur »), facultative
 */
export function buildPosterHtml({ subject, topics, describe, snapshot, author, divider = null, numbers = {}, editorUrl = null }) {
  const labelOf = (id) => {
    const d = describe(id);
    return d.kind === "connaissance" && !d.titled && d.text.trim() ? short(d.text.trim()) : d.label;
  };
  const date = new Date(snapshot.savedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const who = authorName(author);

  const lead = (cls, title, n, text) =>
    text?.trim() ? `<section class="lead ${cls}"><h3>${num(n)}${esc(title)}</h3><p>${esc(text.trim())}</p></section>` : "";
  const leads = lead("problem", "Problématique", numbers.problematique, topics.problematique?.text) + lead("thesis", "Thèse", numbers.these, topics.these?.text);

  const defs = definitionsHtml(topics.definitions, numbers.definitions);
  const side = contradictionsHtml(topics.contradictions, labelOf, numbers.contradictions) + knowledgeHtml(topics.connaissances, labelOf, numbers.connaissances);
  const columns = defs || side ? `<div class="columns"><div class="side">${defs}</div><div class="side">${side}</div></div>` : "";
  const plan = planHtml(topics.plan, topics.connaissances, divider, numbers.plan);

  const toc = [
    leads && ["essentiel", "L’essentiel"],
    topics.definitions && ["definitions", "Définitions"],
    topics.contradictions && ["contradictions", "Contradictions"],
    topics.connaissances && ["connaissances", "Connaissances"],
    topics.plan && ["plan", "Plan"],
  ]
    .filter(Boolean)
    .map(([id, label]) => `<a href="#${id}">${label}</a>`)
    .join("");

  const reform = topics.reformulation?.text?.trim();

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Philosite — dissertation">
<title>${esc(subject)}${who ? ` · ${esc(who)}` : ""}</title>
<style>${STYLE}</style>
</head>
<body class="mode-poster">
<div class="bar" id="bar" role="toolbar" aria-label="Affichage du document">
  <div class="seg" role="group" aria-label="Affichage">
    <button type="button" data-mode="poster" aria-pressed="true">Poster</button>
    <button type="button" data-mode="lecture" aria-pressed="false">Lecture</button>
  </div>
  <button type="button" id="print" aria-label="Imprimer">${ICON_PRINT}<span class="lbl">Imprimer</span></button>
  ${editorUrl ? `<a href="${esc(editorUrl)}" target="_blank" rel="noopener" title="Ouvre l’éditeur : choisissez-y « Reprendre mon travail » puis ce fichier" aria-label="Reprendre dans l’éditeur">${ICON_EDIT}<span class="lbl">Reprendre dans l’éditeur</span></a>` : ""}
</div>
<main class="poster${topics.plan ? "" : " no-plan"}" id="poster">
  <div class="main">
    <header class="head">
      <p class="byline">Dissertation${who ? ` · ${esc(who)}` : ""} · ${esc(date)}</p>
      <h1 class="subject">${esc(subject)}</h1>
      ${reform ? `<p class="reform">${num(numbers.reformulation)}<span>Autrement dit : ${esc(reform)}</span></p>` : ""}
    </header>
    ${toc ? `<nav class="toc" aria-label="Sommaire">${toc}</nav>` : ""}
    ${leads ? `<div class="leads" id="essentiel">${leads}</div>` : ""}
    ${columns ? ornament(divider, "under-head") + columns : ""}
  </div>
  ${plan}
  <p class="foot">${esc(who)}${who ? " · " : ""}${esc(date)}</p>
</main>
<script type="application/json" id="${DATA_ELEMENT_ID}">${embedJson(snapshot)}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
