import Cours from "./Cours";
import CorpusRef from "./CorpusRef";
import CorpusImage from "./CorpusImage";
import CorpusDivider from "./CorpusDivider";
import ContentBlock from "./ContentBlock";
import { renderMarkdown } from "../../lib/markdown";
import { getCorpusText, getBibEntry } from "../../lib/loadCorpusTexts";
import { formatCitation } from "../../lib/bib";

/**
 * Shortcodes reconnus dans le markdown d'une séance :
 *   [[corpus:mon-id]]                        -> extrait de corpus (CorpusRef)
 *   [[image:mon-id]]                         -> image (CorpusImage), pleine largeur, centrée
 *   [[image:mon-id|Une légende]]             -> image avec légende
 *   [[image:mon-id|width:50%]]               -> image redimensionnée
 *   [[image:mon-id|align:left]]              -> image alignée à gauche, texte suivant à côté
 *   [[image:mon-id|align:right|width:35%]]   -> idem à droite, largeur précisée
 *   [[image:mon-id|source:https://...]]      -> ajoute un lien "Source"
 *   [[image:mon-id|Une légende|align:left|width:35%|source:https://...]]  -> tout combiné
 *
 * `align` accepte "left", "right" ou "center" (défaut). En "left"/"right"
 * l'image flotte et le texte qui suit s'écrit à côté (utile pour les
 * images verticales) ; en "center" elle reste seule sur sa ligne, comme
 * avant.
 *
 * Les segments après l'id sont séparés par "|". Un segment "clé:valeur"
 * (ex: width:50%, align:left, source:https://...) est traité comme un
 * paramètre ; tout autre segment est traité comme la légende. L'ordre
 * importe peu.
 *
 * Les [[corpus:id]] sont en plus ajoutés à la bibliographie en bas de la
 * séance ; les [[image:id]] n'y apparaissent pas.
 */
const TOKEN_RE = /\[\[(corpus|image|divider):([a-z0-9_-]+)((?:\|[^\]|]+)*)\]\]/gi;

/**
 * Blocs génériques ::: type [titre optionnel] ... :::
 *   ::: exercice
 *   Décrivez la vision de la beauté défendue dans ce texte.
 *   :::
 *
 *   ::: definition Intersubjectivité
 *   Régularité des jugements de goût entre individus...
 *   :::
 *
 * `type` pilote uniquement la classe CSS (bloc-exercice, bloc-definition...),
 * le rendu visuel est entièrement géré par index.css. Le contenu à
 * l'intérieur est du markdown normal, pouvant contenir des shortcodes
 * [[corpus:...]] / [[image:...]] imbriqués.
 *
 * Chaque ::: doit être seul sur sa ligne (le "m" du flag regex fait
 * matcher ^/$ par ligne).
 */
const BLOCK_RE = /^::: *([a-z0-9_-]+)([^\n]*)\n([\s\S]*?)\n::: *$/gim;

/**
 * "|Une légende|width:50%" -> { caption: "Une légende", params: { width: "50%" } }
 */
function parseSegments(rawSegments) {
  const params = {};
  let caption;

  const segments = (rawSegments || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const colonIdx = segment.indexOf(":");
    if (colonIdx > -1) {
      const key = segment.slice(0, colonIdx).trim().toLowerCase();
      const value = segment.slice(colonIdx + 1).trim();
      params[key] = value;
    } else {
      caption = segment;
    }
  }

  return { caption, params };
}

/**
 * Découpe un fragment de markdown en alternant blocs de texte et
 * shortcodes inline (corpus, image, divider), dans l'ordre d'apparition.
 * Utilisée à la fois pour le contenu global de la séance et pour le
 * contenu interne d'un bloc ::: (l'imbrication [[...]] dans ::: marche
 * donc automatiquement).
 */
function splitInline(markdown) {
  const parts = [];
  let lastIndex = 0;
  let match;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "md", value: markdown.slice(lastIndex, match.index) });
    }

    const [, kind, id, rawSegments] = match;
    const { caption, params } = parseSegments(rawSegments);
    parts.push({ type: kind, id, caption, params });

    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < markdown.length) {
    parts.push({ type: "md", value: markdown.slice(lastIndex) });
  }

  return parts;
}

/**
 * Première passe : isole les blocs ::: type [titre] ... ::: du reste du
 * texte. Le contenu interne d'un bloc n'est volontairement pas re-splitté
 * ici (voir SeanceMarkdown, qui appelle splitInline dessus au rendu) pour
 * garder cette fonction simple et symétrique avec splitInline.
 */
function splitContent(markdown) {
  const parts = [];
  let lastIndex = 0;
  let match;

  BLOCK_RE.lastIndex = 0;
  while ((match = BLOCK_RE.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...splitInline(markdown.slice(lastIndex, match.index)));
    }

    const [, blockType, rawTitle, innerMarkdown] = match;
    parts.push({
      type: "block",
      blockType: blockType.toLowerCase(),
      title: rawTitle.trim() || undefined,
      value: innerMarkdown,
    });

    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < markdown.length) {
    parts.push(...splitInline(markdown.slice(lastIndex)));
  }

  return parts;
}

/**
 * Rend une liste de parts (issues de splitContent ou splitInline) en
 * éléments React. Réutilisée pour le contenu racine de la séance et pour
 * le contenu interne d'un bloc ::: (via renderParts(splitInline(...))).
 */
function renderParts(parts, keyPrefix = "") {
  return parts.map((part, i) => {
    const key = `${keyPrefix}${part.type}-${part.id || i}-${i}`;

    if (part.type === "corpus") {
      return <CorpusRef key={key} id={part.id} />;
    }
    if (part.type === "image") {
      return (
        <CorpusImage
          key={key}
          id={part.id}
          caption={part.caption}
          width={part.params.width}
          source={part.params.source}
          align={part.params.align}
        />
      );
    }
    if (part.type === "divider") {
      return <CorpusDivider key={key} id={part.id} width={part.params.width} />;
    }
    if (part.type === "block") {
      return (
        <ContentBlock key={key} type={part.blockType} title={part.title}>
          {renderParts(splitInline(part.value), `${keyPrefix}${i}-`)}
        </ContentBlock>
      );
    }
    if (!part.value.trim()) return null;
    return (
      <div
        key={key}
        className="markdown-block"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(part.value) }}
      />
    );
  });
}

export default function SeanceMarkdown({ title, markdown }) {
  const parts = splitContent(markdown || "");

  // Bibliographie : un texte de corpus par entrée, dans l'ordre de première
  // apparition, dédupliqué (un même texte peut être cité deux fois dans la
  // séance sans apparaître deux fois en bas de page). Les images n'y
  // figurent pas. On descend aussi dans le contenu des blocs ::: au cas où
  // un [[corpus:...]] y serait cité.
  function collectCorpusIds(list) {
    const ids = [];
    for (const p of list) {
      if (p.type === "corpus") ids.push(p.id);
      if (p.type === "block") ids.push(...collectCorpusIds(splitInline(p.value)));
    }
    return ids;
  }
  const corpusIds = [...new Set(collectCorpusIds(parts))];

  return (
    <Cours title={title}>
      {renderParts(parts)}

      {corpusIds.length > 0 && (
        <section className="bibliographie">
          <h2>Bibliographie</h2>
          <ul>
            {corpusIds.map((id) => {
              const text = getCorpusText(id);
              const entry = text?.zotero ? getBibEntry(text.zotero) : null;
              const citation = formatCitation(entry);
              return (
                <li key={id}>
                  {citation || text?.meta?.oeuvre || (
                    <span className="error-state">Référence introuvable : {id}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Cours>
  );
}