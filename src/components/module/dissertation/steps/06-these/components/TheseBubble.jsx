import Bubble from "../../../lib/Bubble";
import { NARROW } from "../../../lib/canvas";
import { Workspace, Block, RefText } from "../../../lib/Workspace";
import { DefinitionsMaterial, ContradictionsMaterial, KnowledgeMaterial } from "../../../lib/materials";
import { useTopic } from "../../../lib/workspace";

/**
 * Bulle de la thèse (atelier) : problématique, connaissances, définitions, contradictions, puis l'écriture.
 * Sur mobile : plein écran vertical, sans défilement vertical.
 */
export default function TheseBubble({ anchor, text, readOnly, onChange, onClose }) {
  const problem = useTopic("problematique");
  const knowledge = useTopic("connaissances");
  const contradictions = useTopic("contradictions");

  return (
    <Bubble anchor={anchor} width={760} title="Thèse" className="is-workspace" onClose={onClose}>
      <Workspace
        sources={
          <>
            {problem && (
              <Block label="Problématique">
                <RefText text={problem.text} tone="accent" lines={3} />
              </Block>
            )}
            {knowledge && (
              <Block label={`Connaissances (${knowledge.length})`}>
                <KnowledgeMaterial />
              </Block>
            )}
            <Block label="Définitions" hideWhenCompact>
              <DefinitionsMaterial />
            </Block>
            {contradictions && (
              <Block label={`Contradictions (${contradictions.length})`} hideWhenCompact>
                <ContradictionsMaterial />
              </Block>
            )}
          </>
        }
      >
        <label className="dissertation-field">
          <span>{readOnly ? "Thèse" : "Votre thèse"}</span>
          <textarea
            autoFocus={!readOnly && window.innerWidth >= NARROW} // mobile : pas de clavier à l'ouverture
            value={text}
            readOnly={readOnly}
            placeholder="Votre réponse à la problématique, appuyée sur vos connaissances…"
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      </Workspace>
    </Bubble>
  );
}
