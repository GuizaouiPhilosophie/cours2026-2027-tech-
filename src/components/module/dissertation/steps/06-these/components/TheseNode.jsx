import TextNode from "../../../lib/TextNode";

/** Nœud de la carte : la thèse. */
export default function TheseNode({ data }) {
  return <TextNode label={data.label} text={data.text} tone="strong" width={300} />;
}
