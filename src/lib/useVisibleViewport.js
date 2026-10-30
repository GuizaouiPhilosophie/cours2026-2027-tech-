import { useEffect } from "react";

/**
 * Zone réellement visible de l'écran, clavier virtuel compris, partagée par les éditeurs
 * (explication, dissertation).
 *
 * Problème : sur téléphone, le clavier s'ouvre PAR-DESSUS la page. Les éléments en
 * `position: fixed; inset: 0` (éditeur, bulles, fenêtres) gardent la hauteur de l'écran entier,
 * et les champs du bas finissent cachés sous le clavier. Sur iPhone, Safari décale en plus la page
 * vers le haut pour montrer le champ, ce qui fait sortir l'en-tête de l'écran.
 *
 * Solution : on suit window.visualViewport (la partie visible au-dessus du clavier) et on publie
 * sa taille en variables CSS sur <html> :
 *   --vv-top    : décalage du haut de la zone visible (Safari iOS), en px
 *   --vv-height : hauteur visible, en px
 *   --app-height: idem (ancien nom, utilisé par le module d'explication)
 * Les éléments fixes s'y calent (top: var(--vv-top); height: var(--vv-height)).
 * Sur Android, la balise viewport `interactive-widget=resizes-content` (index.html) fait déjà
 * rétrécir la page ; ces variables donnent alors simplement la même valeur.
 *
 * En plus, quand un champ de saisie reçoit le focus (ou quand le clavier change de taille),
 * on le ramène dans la zone visible de son conteneur qui défile.
 */
export function useVisibleViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;
    // Plus grande hauteur vue pour la largeur actuelle : une forte baisse = clavier ouvert
    // (fonctionne aussi sur Android, où la fenêtre entière rétrécit avec le clavier).
    let full = { w: window.innerWidth, h: vv ? vv.height : window.innerHeight };

    const isField = (el) =>
      !!el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !/^(checkbox|radio|button|submit|file|range|color)$/i.test(el.type)) || el.isContentEditable);

    const reveal = () => {
      const el = document.activeElement;
      if (!isField(el)) return;
      // après la mise en page (nouvelle hauteur appliquée)
      requestAnimationFrame(() => el.scrollIntoView({ block: "nearest", inline: "nearest" }));
    };

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const h = vv ? vv.height : window.innerHeight;
        const top = vv ? Math.max(0, vv.offsetTop) : 0;
        root.style.setProperty("--vv-height", `${Math.round(h)}px`);
        root.style.setProperty("--vv-top", `${Math.round(top)}px`);
        root.style.setProperty("--app-height", `${Math.round(h)}px`);
        if (window.innerWidth !== full.w) full = { w: window.innerWidth, h };
        else if (h > full.h) full.h = h;
        // clavier ouvert : la zone visible a nettement baissé, et un champ de saisie a le focus
        const typing = isField(document.activeElement);
        root.classList.toggle("has-keyboard", typing && (full.h - h > 150 || window.innerHeight - h > 120));
      });
    };

    const onResize = () => {
      update();
      reveal();
    };
    const onFocusIn = (e) => {
      if (!isField(e.target)) return;
      update();
      // le clavier met un instant à s'ouvrir : on vérifie aussi un peu plus tard
      setTimeout(reveal, 320);
    };

    update();
    const target = vv || window;
    target.addEventListener("resize", onResize);
    target.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      target.removeEventListener("resize", onResize);
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", update);
      root.classList.remove("has-keyboard");
      ["--vv-height", "--vv-top", "--app-height"].forEach((v) => root.style.removeProperty(v));
    };
  }, []);
}
