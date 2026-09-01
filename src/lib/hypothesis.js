/**
 * Intégration du client d'annotation Hypothesis.
 *
 * Portée : toute la séance (cours + corpus). Il n'y a plus de Shadow DOM
 * pour isoler le corpus du reste (voir Cours.jsx / CorpusText.jsx) — et ce
 * n'est plus voulu : on veut que l'annotation fonctionne sur l'ensemble du
 * contenu d'une séance, pas seulement sur les extraits de corpus. Il n'y a
 * donc plus rien à restreindre côté DOM ni CSS : le client est chargé tel
 * quel, et le flux normal de la page (voir SeancePage.jsx) fait le reste.
 *
 * Un point reste spécifique à ce projet : l'app est une SPA en HashRouter,
 * donc toutes les séances partagent la même URL "de base" (seul le #hash
 * change). Par défaut, Hypothesis se base sur l'URL du document pour savoir
 * quelle "page" annoter — sans rien faire, toutes les séances se
 * retrouveraient à partager le même jeu d'annotations. On corrige ça avec
 * la balise <link rel="canonical">, que le client Hypothesis lit
 * explicitement pour déterminer l'URI d'une page. `setHypothesisUri` la
 * met à jour à chaque changement de séance (voir SeancePage.jsx).
 */

let injected = false;

export function loadHypothesisClient() {
  if (injected) return;
  injected = true;

  if (document.querySelector('script[src*="hypothes.is/embed.js"]')) {
    return;
  }

  // Config officielle du client (doit être définie avant le chargement du
  // script). On ne restreint rien : annotation possible sur toute la page.
  window.hypothesisConfig = function () {
    return {
      showHighlights: true,
      openSidebar: false,
    };
  };

  const script = document.createElement("script");
  script.src = "https://hypothes.is/embed.js";
  script.async = true;
  document.head.appendChild(script);
}

/**
 * Crée ou met à jour la balise <link rel="canonical"> avec l'URL complète
 * de la séance courante (hash inclus), pour que Hypothesis associe les
 * annotations à la bonne séance plutôt qu'à l'app entière.
 */
export function setHypothesisUri(uri) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", uri);
}

let watching = false;

/**
 * Surveille les mises en évidence Hypothesis dans la page (survol ou clic
 * d'une annotation depuis la sidebar) pour permettre à la page hôte de
 * réagir — typiquement, déplier un <CorpusText> replié qui contient
 * l'annotation ciblée.
 *
 * Hypothesis n'expose pas d'événement JS public pour ça côté page hôte : on
 * observe donc les mutations de class/style sur les éléments
 * <mark class="hypothesis-highlight"> que le client insère au fil du texte
 * annoté, et on relaie l'info via un CustomEvent ("philosite:reveal-corpus")
 * que n'importe quel composant peut écouter (voir CorpusText.jsx).
 */
export function watchHypothesisHighlightFocus() {
  if (watching) return;
  watching = true;

  const observer = new MutationObserver((mutations) => {
    for (const { target } of mutations) {
      if (!(target instanceof Element)) continue;
      if (!target.classList.contains("hypothesis-highlight")) continue;

      document.dispatchEvent(
        new CustomEvent("philosite:reveal-corpus", { detail: { target } })
      );
    }
  });

  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });
}