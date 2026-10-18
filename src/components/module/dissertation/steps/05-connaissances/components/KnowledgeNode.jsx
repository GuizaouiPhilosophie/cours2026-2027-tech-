import TextNode from "../../../lib/TextNode";

/** Nœud « Connaissance » : ce que l'élève sait (auteur, notion, exemple…). */
export default function KnowledgeNode({ data }) {
  const n = data.linkCount;
  return (
    <TextNode
      label={`${data.label}${n > 0 ? ` · ${n} lien${n > 1 ? "s" : ""}` : ""}`}
      text={data.text}
      tone="knowledge"
      font="sans"
      width={240}
    />
  );
}
