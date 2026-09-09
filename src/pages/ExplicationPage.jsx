import { useParams, Link } from "react-router-dom";
import ExplicationEditor from "../components/module/explication/ExplicationEditor";
import { getCorpusText } from "../lib/loadCorpusTexts";

/**
 * Page à part (pas de header/nav du site) qui ouvre un texte de corpus
 * dans l'éditeur d'annotation du module d'explication.
 *
 * Route : /#/explication/:textId
 * textId = nom du fichier sans .html, ex. "hume-gout" pour
 * corpus/textes/hume-gout.html
 */
export default function ExplicationPage() {
  const { textId } = useParams();
  const text = getCorpusText(textId);

  if (!text) {
    return (
      <div className="explication-editor explication-editor--error">
        <p className="error-state">Texte introuvable : {textId}</p>
        <Link to="/">Retour à l’accueil</Link>
      </div>
    );
  }

  // Même logique que <CorpusText> : auteur, œuvre, date (fusion Zotero
  // + overrides du .bib), plus la référence de pages — celle-ci ne vient
  // pas du .bib mais du bloc <script data-corpus-meta> propre à CHAQUE
  // fichier corpus/textes/<id>.html (ex. "476a – 476d" pour cet
  // extrait) ; c'est elle qui distingue un extrait d'un autre au sein
  // d'une même œuvre, donc elle a sa place dans le titre autant que dans
  // la marge de métadonnées du cours (où elle apparaît via restMeta).
  const { auteur, oeuvre, date, pages } = text.meta || {};
  const title = [auteur, oeuvre, date, pages].filter(Boolean).join(", ") || textId;

  return <ExplicationEditor title={title} html={text.html} />;
}