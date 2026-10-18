import TextNode from "../../../lib/TextNode";

/** Nœud de la carte : la reformulation du sujet. */
export default function ReformulationNode({ data }) {
  return <TextNode label={data.label} text={data.text} width={300} />;
}
