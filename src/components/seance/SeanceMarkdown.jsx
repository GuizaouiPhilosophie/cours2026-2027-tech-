import Cours from "./Cours";
import CorpusRef from "./CorpusRef";
import CorpusImage from "./CorpusImage";
import CorpusDivider from "./CorpusDivider";
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
 * Découpe le markdown brut en alternant blocs de texte et références
 * (corpus ou image), dans l'ordre d'apparition. Chaque bloc de texte est
 * rendu indépendamment en HTML (voir renderMarkdown) ; les shortcodes
 * deviennent des composants React, jamais du HTML statique.
 */
function splitContent(markdown) {
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

export default function SeanceMarkdown({ title, markdown }) {
  const parts = splitContent(markdown || "");

  // Bibliographie : un texte de corpus par entrée, dans l'ordre de première
  // apparition, dédupliqué (un même texte peut être cité deux fois dans la
  // séance sans apparaître deux fois en bas de page). Les images n'y
  // figurent pas.
  const corpusIds = [...new Set(parts.filter((p) => p.type === "corpus").map((p) => p.id))];

  return (
    <Cours title={title}>
      {parts.map((part, i) => {
        if (part.type === "corpus") {
          return <CorpusRef key={`corpus-${part.id}-${i}`} id={part.id} />;
        }
        if (part.type === "image") {
          return (
            <CorpusImage
              key={`image-${part.id}-${i}`}
              id={part.id}
              caption={part.caption}
              width={part.params.width}
              source={part.params.source}
              align={part.params.align}
            />
          );
        }
        if (part.type === "divider") {
          return (
            <CorpusDivider
              key={`divider-${part.id}-${i}`}
              id={part.id}
              width={part.params.width}
            />
          );
        }
        if (!part.value.trim()) return null;
        return (
          <div
            key={`md-${i}`}
            className="markdown-block"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(part.value) }}
          />
        );
      })}

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
