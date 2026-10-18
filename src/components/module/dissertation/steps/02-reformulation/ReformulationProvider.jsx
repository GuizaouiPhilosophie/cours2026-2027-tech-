import { useCallback, useState } from "react";
import ReformulationBubble from "./components/ReformulationBubble";
import { useWorkspace, useCanvasEvents } from "../../lib/workspace";
import HintBar from "../../lib/HintBar";
import { SUBJECT_ID, centerOf } from "../../lib/canvas";
import { NODE_ID } from "./ids";

const RISE = 300; // distance au-dessus du sujet (unités du canevas)
const NODE_W = 300;

/**
 * Provider de l'étape : la bulle de reformulation.
 * Étape en cours : un clic sur le sujet ou sur le nœud ouvre la bulle. Après validation,
 * un clic sur le nœud l'ouvre en lecture seule.
 */
export default function ReformulationProvider({ status, data, setData, events, children }) {
  const { api } = useWorkspace();
  const [anchor, setAnchor] = useState(null);
  const editable = status === "current";
  const close = useCallback(() => setAnchor(null), []);

  useCanvasEvents(events, {
    onNodeClick: ({ node, anchor: a }) => {
      if (status === "locked") return false;
      if (node.id === NODE_ID || (editable && node.id === SUBJECT_ID)) {
        setAnchor(a);
        return true;
      }
      return false;
    },
  });

  const change = (text) => {
    // Position fixée à la création du nœud : au-dessus du sujet.
    let position = data.position;
    if (!position) {
      const subject = api.getNode(SUBJECT_ID);
      const c = subject ? centerOf(subject) : { x: 0, y: 0 };
      position = { x: c.x - NODE_W / 2, y: (subject?.position.y ?? 0) - RISE };
    }
    setData((d) => ({ ...d, text, position: d.position ?? position }));
  };

  return (
    <>
      {children}
      {editable && !anchor && <HintBar>Cliquez sur le sujet pour le reformuler.</HintBar>}
      {anchor && (
        <ReformulationBubble
          anchor={anchor}
          text={data.text}
          readOnly={!editable}
          onChange={change}
          onClose={close}
        />
      )}
    </>
  );
}
