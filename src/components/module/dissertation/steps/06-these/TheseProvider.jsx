import { useCallback, useState } from "react";
import TheseBubble from "./components/TheseBubble";
import { NODE_ID } from "./ids";
import { useWorkspace, useTopic, useCanvasEvents } from "../../lib/workspace";
import { SUBJECT_ID, centerOf, sizeOf } from "../../lib/canvas";
import HintBar from "../../lib/HintBar";

const NODE_W = 300;
const DROP = 140; // distance sous la problématique (unités du canevas)

/**
 * Provider de l'étape : la bulle de thèse.
 * Étape en cours : clic sur la problématique (topic « problematique ») ou sur le nœud de thèse.
 * Après validation : clic sur le nœud, en lecture seule.
 */
export default function TheseProvider({ status, data, setData, events, children }) {
  const { api } = useWorkspace();
  const problem = useTopic("problematique");
  const [anchor, setAnchor] = useState(null);
  const editable = status === "current";
  const close = useCallback(() => setAnchor(null), []);
  // Sans problématique publiée, le sujet ouvre la bulle.
  const entryId = problem?.nodeId ?? SUBJECT_ID;

  useCanvasEvents(events, {
    onNodeClick: ({ node, anchor: a }) => {
      if (status === "locked") return false;
      if (node.id === NODE_ID || (editable && node.id === entryId)) {
        setAnchor(a);
        return true;
      }
      return false;
    },
  });

  const change = (text) => {
    // Position fixée à la création du nœud : sous la problématique.
    let position = data.position;
    if (!position) {
      const parent = api.getNode(entryId);
      const cx = parent ? centerOf(parent).x : 0;
      const bottom = parent ? parent.position.y + sizeOf(parent).height : 0;
      position = { x: cx - NODE_W / 2, y: bottom + DROP };
    }
    setData((d) => ({ ...d, text, position: d.position ?? position }));
  };

  return (
    <>
      {children}
      {editable && !anchor && (
        <HintBar>
          {problem ? "Cliquez sur la problématique pour rédiger votre thèse." : "Cliquez sur le sujet pour rédiger votre thèse."}
        </HintBar>
      )}
      {anchor && <TheseBubble anchor={anchor} text={data.text} readOnly={!editable} onChange={change} onClose={close} />}
    </>
  );
}
