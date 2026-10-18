import TextNode from "../../../lib/TextNode";

/** Nœud de la carte : la problématique. */
export default function ProblematiqueNode({ data }) {
  return <TextNode label={data.label} text={data.text} tone="accent" width={300} />;
}
