/** Ancre de bulle ({ x, top, bottom }, coordonnées écran) à partir d'un élément… */
export const rectAnchor = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, top: r.top, bottom: r.bottom };
};

/** … ou d'un point (clic sur un lien, double-clic dans le vide). */
export const pointAnchor = (x, y) => ({ x, top: y, bottom: y });
