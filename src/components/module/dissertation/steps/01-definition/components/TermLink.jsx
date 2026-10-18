import { byId } from "../lib/definitions";
import HoverTip from "../../../lib/HoverTip";

/** Pastille d'un terme du glossaire : définition au survol, clic = consulter. */
export default function TermLink({ id, onClick, active = false }) {
  const term = byId.get(id);
  if (!term) return null;
  return (
    <HoverTip
      content={
        <>
          <strong>{term.terme}</strong> — {term.definition}
        </>
      }
    >
      <button
        type="button"
        className={`dissertation-chip${active ? " is-active" : ""}`}
        aria-pressed={onClick ? active : undefined}
        onClick={() => onClick?.(id)}
      >
        {term.terme}
      </button>
    </HoverTip>
  );
}