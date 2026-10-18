import { useEffect, useMemo, useState } from "react";
import { Handle, useNodeId, useUpdateNodeInternals } from "@xyflow/react";
import { tokenize } from "./lib/definitions";
import { useDefinitions } from "./context";
import { wordHandle } from "./lib/placement";
import { SIDES, POSITION } from "../../lib/canvas";

/**
 * Texte du sujet, mot par mot. Chaque mot porte une poignée invisible par côté, d'où part
 * le lien vers ses définitions (DefinitionEdge).
 *  - étape en cours : les mots sont des boutons ; un clic définit le mot, et sur un mot déjà défini
 *    affiche « + définition » pour en ajouter une autre ;
 *  - sinon : texte simple (un clic sur le sujet revient alors à l'étape en cours, ex. la reformulation).
 */
export default function SubjectText({ text }) {
  const { entries, openWord, editable, setMenuOpen } = useDefinitions();
  const nodeId = useNodeId();
  const updateInternals = useUpdateNodeInternals();
  const tokens = useMemo(() => tokenize(text), [text]);
  const [menu, setMenu] = useState(null); // index du mot dont le bouton « + » est affiché
  const menuShown = editable ? menu : null;

  const showMenu = (i) => {
    setMenu(i);
    setMenuOpen(i !== null);
  };

  // Les poignées sont à l'intérieur du texte : les re-mesurer quand la mise en page change.
  useEffect(() => {
    updateInternals(nodeId);
    document.fonts?.ready.then(() => updateInternals(nodeId));
  }, [nodeId, updateInternals, tokens, editable]);

  // Ferme le bouton « + » en cliquant ailleurs.
  useEffect(() => {
    if (menuShown === null) return;
    const close = (e) => {
      if (e.target.closest?.(".dissertation-wordwrap")) return;
      setMenu(null);
      setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuShown, setMenuOpen]);

  const seen = new Set(); // un mot répété n'a qu'une série de poignées

  return (
    // <div> et non <p> : les <Handle> de React Flow rendent des <div>, interdits dans un <p>.
    <div role="paragraph" className="dissertation-subject-text">
      {tokens.map((t, i) => {
        if (t.type === "sep") return t.text;
        const first = !seen.has(t.key);
        seen.add(t.key);
        const defined = entries[t.key]?.length > 0;
        return (
          <span key={i} className="dissertation-wordwrap">
            {editable ? (
              <button
                type="button"
                className={`dissertation-word nodrag nopan${defined ? " is-defined" : ""}`}
                onClick={(e) => {
                  if (defined) showMenu(menu === i ? null : i);
                  else openWord(t.text, t.key, e.currentTarget);
                }}
              >
                {t.text}
              </button>
            ) : (
              <span className={`dissertation-word is-static${defined ? " is-defined" : ""}`}>{t.text}</span>
            )}
            {menuShown === i && (
              <button
                type="button"
                className="dissertation-addword nodrag nopan"
                onClick={(e) => {
                  const word = e.currentTarget.parentElement.querySelector(".dissertation-word");
                  showMenu(null);
                  openWord(t.text, t.key, word); // sans id : nouvelle définition
                }}
              >
                + définition
              </button>
            )}
            {first &&
              SIDES.map((side) => (
                <Handle
                  key={side}
                  id={wordHandle(t.key, side)}
                  type="source"
                  position={POSITION[side]}
                  isConnectable={false}
                  className="dissertation-handle"
                />
              ))}
          </span>
        );
      })}
    </div>
  );
}
