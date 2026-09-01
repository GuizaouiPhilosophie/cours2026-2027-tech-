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
 *
 * Groupe privé : pour éviter que n'importe qui annote publiquement la page
 * (bruit, texte random visible par tous), le client est épinglé sur le
 * groupe privé "Cours de philosophie" via l'option `group`. Seuls les
 * membres du groupe (invités via le lien de partage hypothes.is) peuvent
 * voir et créer des annotations — il n'y a plus de calque "Public" affiché.
 * Un élève doit avoir un compte Hypothesis et avoir rejoint le groupe pour
 * voir quoi que ce soit ici.
 */

let injected = false;

// ID du groupe privé "Cours de philosophie" (visible dans l'URL de gestion
// du groupe sur hypothes.is : https://hypothes.is/groups/<GROUP_ID>/edit).
const HYPOTHESIS_GROUP_ID = "mDDE48NQ";

export function loadHypothesisClient() {
  if (injected) return;
  injected = true;

  if (document.querySelector('script[src*="hypothes.is/embed.js"]')) {
    return;
  }

  // Config officielle du client (doit être définie avant le chargement du
  // script). `groups` (au pluriel, pas `group`) restreint la LISTE des
  // groupes proposés par le client à ce seul groupe privé : le calque
  // "Public" n'apparaît alors même plus dans le sélecteur, il n'y a donc
  // plus moyen d'y écrire ou d'y lire quoi que ce soit depuis cette page.
  // (`group` seul ne fait que présélectionner le groupe actif par défaut,
  // mais laisse "Public" accessible en changeant de groupe dans le client.)
  window.hypothesisConfig = function () {
    return {
      showHighlights: true,
      openSidebar: false,
      groups: [HYPOTHESIS_GROUP_ID],
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