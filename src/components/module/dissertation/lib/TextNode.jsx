import NodeHandles from "./NodeHandles";
import "./ui.css";

/**
 * Nœud « carte » commun : un libellé en haut, le texte, un contenu facultatif.
 *   tone   : "plain" | "accent" | "strong" | "contradiction" | "knowledge" (liseré et couleur du libellé)
 *   font   : "serif" | "sans"
 *   width  : largeur en px
 *   empty  : texte affiché en italique quand `text` est vide
 *   action : bouton placé dans le coin (il gère son propre clic)
 * Le texte long est coupé : la bulle de l'étape (ouvrable même après validation) l'affiche en entier.
 */
export default function TextNode({ label, text, tone = "plain", font = "serif", width = 260, empty, action, children }) {
  const hasText = !!text?.trim();
  return (
    <div className={`dissertation-textnode is-${tone} is-${font}`} style={{ width }}>
      <NodeHandles />
      {action}
      <span className="dissertation-textnode-label">{label}</span>
      {hasText ? <p>{text}</p> : empty ? <p className="is-empty">{empty}</p> : null}
      {children}
    </div>
  );
}
