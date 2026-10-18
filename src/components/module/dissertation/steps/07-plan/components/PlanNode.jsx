import TextNode from "../../../lib/TextNode";
import { partById, isComplete } from "../lib/parts";

/**
 * Nœud d'une partie du plan (I, II ou III) : l'idée directrice, la limite (ou la réponse au sujet
 * pour la III) et le nombre de connaissances mobilisées. Liseré foncé quand la partie est complète.
 */
export default function PlanNode({ data }) {
  const part = partById[data.part];
  if (!part) return null;
  const second = part.fields[1];
  const count = data.knowledge?.length ?? 0;

  return (
    <TextNode label={data.label} text={data.idea} tone={isComplete(part, data) ? "strong" : "plain"} width={260}>
      {data[second.key]?.trim() && (
        <p className="dissertation-plannode-second">
          <em>{part.id === "depassement" ? "Réponse : " : "Limite : "}</em>
          {data[second.key]}
        </p>
      )}
      {count > 0 && (
        <span className="dissertation-plannode-count">
          {count} connaissance{count > 1 ? "s" : ""}
        </span>
      )}
    </TextNode>
  );
}
