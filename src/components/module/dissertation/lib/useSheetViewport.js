import { useEffect, useState } from "react";

/**
 * Bulles en plein écran sur petit écran (« feuille »), commun à toutes les étapes.
 * Suit la zone réellement visible (visualViewport) : quand le clavier s'ouvre, la bulle
 * rétrécit au lieu de passer dessous.
 *   active : la bulle est en mode feuille
 * Renvoie { style, height } : style à appliquer à la bulle ({} si inactif), hauteur visible (px) ou null.
 */
export default function useSheetViewport(active) {
  const [vp, setVp] = useState(null);

  useEffect(() => {
    if (!active) return;
    const v = window.visualViewport;
    const update = () =>
      setVp(v ? { top: v.offsetTop, height: v.height } : { top: 0, height: window.innerHeight });
    update();
    v?.addEventListener("resize", update);
    v?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      v?.removeEventListener("resize", update);
      v?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [active]);

  if (!active || !vp) return { style: {}, height: null };
  return {
    height: vp.height,
    style: {
      top: `calc(${vp.top + 8}px + env(safe-area-inset-top, 0px))`,
      height: `calc(${vp.height - 16}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`,
    },
  };
}
