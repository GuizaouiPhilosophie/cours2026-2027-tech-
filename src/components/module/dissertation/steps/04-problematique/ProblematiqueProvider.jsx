import { useCallback, useState } from "react";
import ProblematiqueBubble from "./components/ProblematiqueBubble";
import { NODE_ID } from "./ids";
import { useWorkspace, useCanvasEvents } from "../../lib/workspace";
import HintBar from "../../lib/HintBar";
import { SUBJECT_ID, centerOf, lowestBottom } from "../../lib/canvas";

const NODE_W = 300;
const DROP = 140; // distance sous le nœud le plus bas de la carte (unités du canevas)

/**
 * Provider de l'étape : la bulle de problématique.
 * Étape en cours : clic sur le sujet ou sur le nœud. Après validation : clic sur le nœud, en lecture seule.
 */
export default function ProblematiqueProvider({ status, data, setData, events, children }) {
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
    // Position fixée à la création du nœud : centré sous le sujet, sous tout ce qui est déjà sur la carte.
    let position = data.position;
    if (!position) {
      const subject = api.getNode(SUBJECT_ID);
      const cx = subject ? centerOf(subject).x : 0;
      position = { x: cx - NODE_W / 2, y: lowestBottom(api.getNodes()) + DROP };
    }
    setData((d) => ({ ...d, text, position: d.position ?? position }));
  };

  return (
    <>
      {children}
      {editable && !anchor && <HintBar>Cliquez sur le sujet pour formuler la problématique.</HintBar>}
      {anchor && (
        <ProblematiqueBubble anchor={anchor} text={data.text} readOnly={!editable} onChange={change} onClose={close} />
      )}
    </>
  );
}
