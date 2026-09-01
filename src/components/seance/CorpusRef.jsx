import CorpusText from "./CorpusText";
import { getCorpusText } from "../../lib/loadCorpusTexts";

/**
 * Pont entre une séance et un fichier corpus/textes/<id>.html.
 * Récupère le html + les métadonnées (fusion Zotero + overrides locaux)
 * et les passe à <CorpusText>.
 *
 * Usage dans une séance :
 *   <CorpusRef id="platon-republique-476a-476d" />
 */
export default function CorpusRef({ id, defaultOpen }) {
  const text = getCorpusText(id);

  if (!text) {
    return <p className="error-state">Texte de corpus introuvable : {id}</p>;
  }

  return (
    <CorpusText meta={text.meta} defaultOpen={defaultOpen}>
      <div dangerouslySetInnerHTML={{ __html: text.html }} />
    </CorpusText>
  );
}
