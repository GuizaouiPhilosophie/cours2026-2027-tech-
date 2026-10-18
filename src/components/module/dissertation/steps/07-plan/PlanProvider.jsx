import { useCallback, useState } from "react";
import "./plan.css";
import PlanBubble from "./components/PlanBubble";
import { PARTS, isComplete } from "./lib/parts";
import { useWorkspace, useTopic, useCanvasEvents } from "../../lib/workspace";
import { SUBJECT_ID, centerOf, sizeOf } from "../../lib/canvas";
import HintBar from "../../lib/HintBar";

const STEP_ID = "plan";
const NODE_W = 260;
const GAP = 40;
const DROP = 160; // distance sous la thèse (unités du canevas)

/**
 * Provider de l'étape : la bulle du plan.
 * Étape en cours : clic sur la thèse (topic « these » ; première partie incomplète) ou sur une partie.
 * Après validation : clic sur une partie, en lecture seule.
 */
export default function PlanProvider({ status, data, setData, events, children }) {
  const { api } = useWorkspace();
  const thesis = useTopic("these");
  const [bubble, setBubble] = useState(null); // { anchor, part }
  const editable = status === "current";
  const entryId = thesis?.nodeId ?? SUBJECT_ID;
  const close = useCallback(() => setBubble(null), []);

  const firstIncomplete = () => PARTS.find((p) => !isComplete(p, data.parts[p.id]))?.id ?? PARTS[0].id;

  useCanvasEvents(events, {
    onNodeClick: ({ node, anchor }) => {
      if (status === "locked") return false;
      if (node.data.owner === STEP_ID) {
        setBubble({ anchor, part: node.data.part });
        return true;
      }
      if (editable && node.id === entryId) {
        setBubble({ anchor, part: firstIncomplete() });
        return true;
      }
      return false;
    },
  });

  /** Position d'une partie à sa création : trois colonnes sous la thèse (I à gauche, III à droite). */
  const placePart = (partId) => {
    const parent = api.getNode(entryId);
    const cx = parent ? centerOf(parent).x : 0;
    const y = (parent ? parent.position.y + sizeOf(parent).height : 0) + DROP;
    const index = PARTS.findIndex((p) => p.id === partId);
    return { x: cx + (index - 1) * (NODE_W + GAP) - NODE_W / 2, y };
  };

  const update = (partId, patch) => {
    const position = data.parts[partId].position ?? placePart(partId);
    setData((d) => ({
      ...d,
      parts: { ...d.parts, [partId]: { ...d.parts[partId], ...patch, position: d.parts[partId].position ?? position } },
    }));
  };

  const toggleKnowledge = (partId, kid) => {
    const list = data.parts[partId].knowledge;
    update(partId, { knowledge: list.includes(kid) ? list.filter((k) => k !== kid) : [...list, kid] });
  };

  return (
    <>
      {children}
      {editable && !bubble && (
        <HintBar>
          {thesis ? "Cliquez sur la thèse pour construire votre plan." : "Cliquez sur le sujet pour construire votre plan."}
        </HintBar>
      )}
      {bubble && (
        <PlanBubble
          anchor={bubble.anchor}
          part={bubble.part}
          parts={data.parts}
          readOnly={!editable}
          onSelectPart={(part) => setBubble((b) => ({ ...b, part }))}
          onChange={(key, text) => update(bubble.part, { [key]: text })}
          onToggleKnowledge={(kid) => toggleKnowledge(bubble.part, kid)}
          onClose={close}
        />
      )}
    </>
  );
}
