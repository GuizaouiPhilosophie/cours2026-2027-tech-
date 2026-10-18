/**
 * Ornement de séparation du poster exporté : src/assets/dividers/fantasy-1.svg,
 * lu au build (?raw) et embarqué en data URL pour que le fichier HTML reste autonome.
 */
import dividerSvg from "../../../../assets/dividers/fantasy-1.svg?raw";

const DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(dividerSvg)}`;

/** Data URL de l'ornement (même interface qu'avant : une promesse). */
export function loadDividerDataUrl() {
  return Promise.resolve(DATA_URL);
}