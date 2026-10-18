import { normalize } from "../lib/definitions";

/** Liste alphabétique (déjà triée) des termes, groupée par initiale. */
export default function Glossary({ terms, onSelect, selectedId }) {
  if (terms.length === 0) {
    return <p className="dissertation-tools-empty">Aucun terme trouvé.</p>;
  }

  const groups = [];
  for (const t of terms) {
    const letter = normalize(t.terme)[0].toUpperCase();
    const last = groups[groups.length - 1];
    if (last?.letter === letter) last.items.push(t);
    else groups.push({ letter, items: [t] });
  }

  return (
    <div className="dissertation-glossary">
      {groups.map((g) => (
        <section key={g.letter}>
          <h4>{g.letter}</h4>
          <ul>
            {g.items.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`dissertation-result${t.id === selectedId ? " is-selected" : ""}`}
                  onClick={() => onSelect(t)}
                >
                  <strong>{t.terme}</strong>
                  <span>{t.definition}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
