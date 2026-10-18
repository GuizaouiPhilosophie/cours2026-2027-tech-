import Bubble from "../../../lib/Bubble";
import { Workspace, Block, RefText } from "../../../lib/Workspace";
import { KnowledgeMaterial } from "../../../lib/materials";
import { useWorkspace, useTopic } from "../../../lib/workspace";
import { NARROW } from "../../../lib/canvas";
import { PARTS, partById, isComplete } from "../lib/parts";

/**
 * Bulle du plan dialectique (atelier) :
 *  - à gauche : sujet, problématique, thèse, puis les connaissances à mobiliser dans la partie affichée ;
 *  - à droite : onglets I / II / III, consigne de la partie et ses deux champs.
 * Mobile : plein écran vertical, sans défilement vertical.
 */
export default function PlanBubble({ anchor, part, parts, readOnly, onSelectPart, onChange, onToggleKnowledge, onClose }) {
  const { subject } = useWorkspace();
  const problem = useTopic("problematique");
  const thesis = useTopic("these");
  const knowledge = useTopic("connaissances");
  const current = partById[part];
  const values = parts[part];

  return (
    <Bubble anchor={anchor} width={820} title="Plan dialectique" className="is-workspace is-plan" onClose={onClose}>
      <Workspace
        sources={
          <>
            <Block label="Sujet" hideWhenCompact>
              <RefText text={subject} lines={1} />
            </Block>
            {problem && (
              <Block label="Problématique" hideWhenCompact>
                <RefText text={problem.text} tone="accent" />
              </Block>
            )}
            {thesis && (
              <Block label="Thèse">
                <RefText text={thesis.text} tone="strong" />
              </Block>
            )}
            {knowledge && (
              <Block label={readOnly ? `Connaissances mobilisées en ${current.num}` : `Connaissances : touchez pour les mobiliser en ${current.num}`}>
                <KnowledgeMaterial
                  isActive={(kid) => values.knowledge.includes(kid)}
                  onToggle={readOnly ? undefined : onToggleKnowledge}
                  footer={(k) => {
                    const usedIn = PARTS.filter((p) => parts[p.id].knowledge.includes(k.id));
                    return (
                      <span className="dissertation-plan-used">
                        {usedIn.length === 0
                          ? "Non mobilisée"
                          : usedIn.map((p) => (
                              <span key={p.id} className={`dissertation-plan-badge${p.id === part ? " is-current" : ""}`}>
                                {p.num}
                              </span>
                            ))}
                      </span>
                    );
                  }}
                />
              </Block>
            )}
          </>
        }
      >
        <div className="dissertation-plan-tabs" role="tablist" aria-label="Parties du plan">
          {PARTS.map((p) => {
            const done = isComplete(p, parts[p.id]);
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={p.id === part}
                className={`dissertation-plan-tab${p.id === part ? " is-active" : ""}${done ? " is-done" : ""}`}
                onClick={() => onSelectPart(p.id)}
              >
                <span className="dissertation-plan-tab-num">{done ? "✓" : p.num}</span>
                {p.title}
              </button>
            );
          })}
        </div>

        <p className="dissertation-plan-goal">{current.goal}</p>

        {current.fields.map((f, i) => (
          <label key={`${part}-${f.key}`} className="dissertation-field">
            <span>{f.label}</span>
            <textarea
              autoFocus={!readOnly && i === 0 && window.innerWidth >= NARROW}
              value={values[f.key]}
              readOnly={readOnly}
              placeholder={f.placeholder}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          </label>
        ))}
      </Workspace>
    </Bubble>
  );
}
