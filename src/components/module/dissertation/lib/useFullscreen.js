import { useCallback, useEffect, useState } from "react";

const isSupported = () =>
  typeof document !== "undefined" && !!document.documentElement.requestFullscreen;

/**
 * Plein écran manuel : aucun passage automatique, c'est l'utilisateur qui décide.
 * `supported` : l'API existe (absente sur iPhone/Safari → le bouton est masqué).
 * `isFullscreen` : état courant (suit aussi les sorties via Échap ou le geste système).
 * `toggle` : à appeler depuis un clic (geste utilisateur exigé par les navigateurs).
 * Quitte le plein écran en quittant la page.
 */
export function useFullscreen() {
  const supported = isSupported();
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== "undefined" && !!document.fullscreenElement
  );

  useEffect(() => {
    if (!supported) return;
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [supported]);

  const toggle = useCallback(async () => {
    if (!supported) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* refusé ou non supporté : on ignore */
    }
  }, [supported]);

  return { supported, isFullscreen, toggle };
}