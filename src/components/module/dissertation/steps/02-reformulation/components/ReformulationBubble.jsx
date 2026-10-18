import Bubble from "../../../lib/Bubble";
import { Block, RefText } from "../../../lib/Workspace";
import { DefinitionsMaterial } from "../../../lib/materials";
import { useWorkspace } from "../../../lib/workspace";

/**
 * Bulle de reformulation : sujet d'origine, définitions (pastilles → définitions et définitions liées),
 * puis la zone d'écriture, enregistrée à chaque frappe.
 */
export default function ReformulationBubble({ anchor, text, readOnly, onChange, onClose }) {
  const { subject } = useWorkspace();
  return (
    <Bubble anchor={anchor} width={460} title="Reformulation" label="Reformulation du sujet" onClose={onClose}>
      <Block label="Sujet d'origine">
        <RefText text={subject} />
      </Block>

      <Block label="Vos définitions">
        <DefinitionsMaterial />
      </Block>

      <label className="dissertation-field dissertation-field-grow">
        <span>Votre reformulation</span>
        <textarea
          autoFocus={!readOnly}
          rows={8}
          value={text}
          readOnly={readOnly}
          placeholder="Reformulez le sujet avec vos propres mots…"
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </Bubble>
  );
}
