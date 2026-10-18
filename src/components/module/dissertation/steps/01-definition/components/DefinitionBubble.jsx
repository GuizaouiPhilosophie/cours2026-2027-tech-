import { useMemo, useRef, useState } from "react";
import { byId, searchTerms, filterGlossary } from "../lib/definitions";
import Bubble from "../../../lib/Bubble";
import Glossary from "./Glossary";

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// Hauteur de la liste du glossaire (px), réglable avec la barre de glissement.
const GLOSSARY_H = 130; // ≈ 1 entrée et demie : le 1er terme et un bout du 2e
const GLOSSARY_MIN = 80;
const GLOSSARY_STEP = 32;

/**
 * Bulle de définition d'un mot du sujet.
 * - la définition rédigée est enregistrée à chaque frappe (onChange) ;
 * - la recherche (vide au départ) propose des termes du glossaire ;
 * - cliquer un terme (glossaire ou recherche) l'applique directement et le met en surbrillance ;
 *   une confirmation n'est demandée que si le texte actuel est une définition personnelle.
 * `readOnly` : étape validée, on relit la définition sans pouvoir la modifier.
 * `title` : terme défini (vide = le mot du sujet `word`), modifiable à tout moment via le crayon.
 */
export default function DefinitionBubble({ word, title, anchor, entry, readOnly = false, onChange, onRename, onClose }) {
  const term = title?.trim() || word;
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [pending, setPending] = useState(null); // terme en attente de confirmation
  const [glossaryH, setGlossaryH] = useState(GLOSSARY_H);
  const boxRef = useRef(null); // conteneur de la liste du glossaire
  const drag = useRef(null); // { y, h } au début du glissement

  const text = entry?.text ?? "";
  // Terme du glossaire actuellement appliqué (surbrillance) ; plus rien si le texte a été modifié à la main.
  const source = entry?.source ? byId.get(entry.source) : null;
  const selectedId = source && source.definition === text ? source.id : null;
  // Définition personnelle : du texte qui n'est pas celle d'un terme du glossaire.
  const isCustom = text.trim() !== "" && selectedId === null;
  const results = useMemo(
    () => (showGlossary ? filterGlossary(query) : searchTerms(query)),
    [showGlossary, query]
  );

  const apply = (term) => {
    setPending(null);
    onChange({ text: term.definition, source: term.id });
  };

  // Clic sur un terme : appliqué tout de suite, sauf s'il écraserait une définition personnelle.
  const select = (term) => {
    if (term.id === selectedId) return;
    if (isCustom) setPending(term);
    else apply(term);
  };

  // Hauteur actuellement affichée de la liste (peut être inférieure à celle demandée si la place manque).
  const shownHeight = () => boxRef.current?.offsetHeight ?? glossaryH;

  // Hauteur maximale possible : tout le reste de la bulle (champ, recherche, confirmation…) doit rester visible.
  // Mesure : on demande une hauteur énorme ; le navigateur la réduit à la place réellement disponible.
  const maxGlossary = () => {
    const box = boxRef.current;
    if (!box) return glossaryH;
    const prev = box.style.flexBasis;
    box.style.flexBasis = "9999px";
    const h = box.offsetHeight;
    box.style.flexBasis = prev;
    return h;
  };

  const resizeGlossary = (h) =>
    setGlossaryH(clamp(h, GLOSSARY_MIN, Math.max(maxGlossary(), GLOSSARY_MIN)));

  const gripDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, h: shownHeight() };
  };
  const gripMove = (e) => {
    if (drag.current) resizeGlossary(drag.current.h + e.clientY - drag.current.y);
  };
  const gripEnd = () => {
    drag.current = null;
  };
  const gripKey = (e) => {
    if (e.key === "ArrowDown") resizeGlossary(shownHeight() + GLOSSARY_STEP);
    else if (e.key === "ArrowUp") resizeGlossary(shownHeight() - GLOSSARY_STEP);
    else return;
    e.preventDefault();
  };

  return (
    <Bubble
      anchor={anchor}
      title={term}
      subtitle={term !== word ? `Lié à « ${word} » dans le sujet` : undefined}
      label={`Définition de « ${term} »`}
      onRename={onRename}
      renamePlaceholder={word}
      onClose={onClose}
    >
      {/* Plein écran (mobile) : le champ remplit la place libre, sauf quand le glossaire est ouvert */}
      <label className={`dissertation-field${showGlossary ? "" : " dissertation-field-grow"}`}>
        <span>{readOnly ? "Définition" : "Votre définition"}</span>
        <textarea
          autoFocus={!readOnly}
          rows={4}
          value={text}
          readOnly={readOnly}
          placeholder="Rédigez votre définition…"
          onChange={(e) => onChange({ text: e.target.value, source: entry?.source })}
        />
      </label>

      {!readOnly && (
        <div className="dissertation-search">
          <input
            type="search"
            value={query}
            placeholder="Chercher dans le glossaire…"
            aria-label="Chercher dans le glossaire"
            onChange={(e) => {
              setQuery(e.target.value);
              setSearching(true);
            }}
          />
          <button
            type="button"
            className={`dissertation-tool${showGlossary ? " is-active" : ""}`}
            aria-pressed={showGlossary}
            onClick={() => setShowGlossary((g) => !g)}
          >
            Glossaire
          </button>
        </div>
      )}

      {pending && (
        <div className="dissertation-confirm" role="alert">
          <p>
            Remplacer votre définition par celle de <strong>{pending.terme}</strong> ?
          </p>
          <div className="dissertation-confirm-actions">
            <button type="button" className="dissertation-validate" onClick={() => apply(pending)}>
              Remplacer
            </button>
            <button type="button" className="dissertation-tool" onClick={() => setPending(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {!readOnly &&
        (showGlossary ? (
          <div className="dissertation-glossary-resizable">
            <div ref={boxRef} className="dissertation-glossary-box" style={{ flexBasis: glossaryH }}>
              <Glossary terms={results} selectedId={selectedId} onSelect={select} />
            </div>
            <div
              className="dissertation-grip"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Redimensionner la liste du glossaire"
              aria-valuenow={glossaryH}
              aria-valuemin={GLOSSARY_MIN}
              tabIndex={0}
              onPointerDown={gripDown}
              onPointerMove={gripMove}
              onPointerUp={gripEnd}
              onPointerCancel={gripEnd}
              onKeyDown={gripKey}
            >
              <span />
            </div>
          </div>
        ) : (
          searching &&
          query.trim() &&
          (results.length === 0 ? (
            <p className="dissertation-tools-empty">Aucun terme trouvé.</p>
          ) : (
            <ul className="dissertation-results">
              {results.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`dissertation-result${t.id === selectedId ? " is-selected" : ""}`}
                    onClick={() => select(t)}
                  >
                    <strong>{t.terme}</strong>
                    <span>{t.definition}</span>
                  </button>
                </li>
              ))}
            </ul>
          ))
        ))}
    </Bubble>
  );
}
