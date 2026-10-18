import Bubble from "../../../lib/Bubble";
import { NARROW } from "../../../lib/canvas";
import { Workspace, Block, RefText } from "../../../lib/Workspace";
import { DefinitionsMaterial, ContradictionsMaterial } from "../../../lib/materials";
import { useWorkspace, useTopic } from "../../../lib/workspace";

/**
 * Bulle de problématique (atelier) : sujet, reformulation, définitions, contradictions, puis l'écriture.
 * Sur mobile : plein écran vertical, sans défilement vertical.
 */
export default function ProblematiqueBubble({ anchor, text, readOnly, onChange, onClose }) {
  const { subject } = useWorkspace();
  const reformulation = useTopic("reformulation");
  const contradictions = useTopic("contradictions");

  return (
    <Bubble anchor={anchor} width={760} title="Problématique" className="is-workspace" onClose={onClose}>
      <Workspace
        sources={
          <>
            <Block label="Sujet">
              <RefText text={subject} />
            </Block>
            {reformulation && (
              <Block label="Votre reformulation" hideWhenCompact>
                <RefText text={reformulation.text} />
              </Block>
            )}
            <Block label="Définitions">
              <DefinitionsMaterial />
            </Block>
            {contradictions && (
              <Block label={`Contradictions (${contradictions.length})`}>
                <ContradictionsMaterial />
              </Block>
            )}
          </>
        }
      >
        <label className="dissertation-field">
          <span>{readOnly ? "Problématique" : "Votre problématique"}</span>
          <textarea
            autoFocus={!readOnly && window.innerWidth >= NARROW} // mobile : pas de clavier à l'ouverture
            value={text}
            readOnly={readOnly}
            placeholder="Partez d'une contradiction pour formuler la question que pose le sujet…"
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      </Workspace>
    </Bubble>
  );
}
