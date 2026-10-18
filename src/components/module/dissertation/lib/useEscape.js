import { useEffect } from "react";

/** Appelle `handler` quand on appuie sur Échap. */
export default function useEscape(handler) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") handler();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handler]);
}
