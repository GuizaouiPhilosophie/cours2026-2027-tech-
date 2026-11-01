import { useEffect, useRef } from "react";

/**
 * Vidéo intégrée au fil du cours : YouTube (par défaut) ou Instagram.
 *
 * Usage dans une séance :
 *   [[video:nwfQTeDEckU]]                          (YouTube)
 *   [[video:nwfQTeDEckU|Une légende]]
 *   [[video:nwfQTeDEckU|start:2:00|end:2:35]]      (extrait de 2:00 à 2:35)
 *   [[video:nwfQTeDEckU|start:90|width:70%]]       (secondes acceptées aussi)
 *   [[video:C8fwXsKsNOO|site:insta]]               (reel Instagram public)
 *   [[video:nwfQTeDEckU|align:left]]               (flotte à gauche, texte à côté)
 *   [[video:C8fwXsKsNOO|site:insta|align:right|width:35%]]
 *
 * `align` : "left", "right" ou "center" (défaut), comme pour les images.
 * En "left"/"right" la vidéo flotte et le texte qui suit s'écrit à côté ;
 * sur petit écran elle repasse pleine largeur au-dessus du texte.
 *
 * L'id :
 *   - YouTube   : la partie après "v=" dans l'URL ;
 *   - Instagram : le code après "/reel/" (ou "/p/") dans l'URL.
 *
 * start / end (YouTube seulement) acceptent "m:ss", "h:mm:ss" ou des
 * secondes. Instagram ne permet pas de couper un extrait.
 *
 * Limite YouTube : la lecture s'arrête bien à `end`, mais l'élève peut
 * toujours déplacer le curseur pour voir le reste de la vidéo.
 */

// "2:35" -> 155 ; "1:02:03" -> 3723 ; "90" -> 90
function toSeconds(value) {
  if (!value) return undefined;
  const parts = String(value).split(":").map(Number);
  if (parts.some(Number.isNaN)) return undefined;
  return parts.reduce((total, n) => total * 60 + n, 0);
}

/**
 * Instagram : méthode officielle (blockquote + script embed.js d'Instagram).
 * Un <iframe> pointant directement vers /embed/ reste blanc une fois
 * intégré dans le site, alors que le script d'Instagram fonctionne et
 * règle lui-même la hauteur du lecteur.
 *
 * Le blockquote est injecté en HTML brut : embed.js le remplace par une
 * iframe, et React ne doit pas essayer de gérer ce nœud lui-même.
 */
const INSTA_SCRIPT_ID = "instagram-embed-js";

function processInstagram() {
  window.instgrm?.Embeds?.process();
}

function loadInstagramScript() {
  if (window.instgrm) {
    processInstagram();
    return;
  }
  let script = document.getElementById(INSTA_SCRIPT_ID);
  if (!script) {
    script = document.createElement("script");
    script.id = INSTA_SCRIPT_ID;
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
  }
  script.addEventListener("load", processInstagram, { once: true });
}

function InstagramEmbed({ id }) {
  const ref = useRef(null);
  const permalink = `https://www.instagram.com/p/${id}/`;

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = `
      <blockquote class="instagram-media" data-instgrm-captioned
        data-instgrm-permalink="${permalink}?utm_source=ig_embed"
        data-instgrm-version="14">
        <a href="${permalink}" target="_blank" rel="noreferrer">
          Voir la vidéo sur Instagram
        </a>
      </blockquote>`;
    loadInstagramScript();
  }, [permalink]);

  return <div ref={ref} className="corpus-video-insta" />;
}

function youtubeSrc(id, start, end) {
  const params = new URLSearchParams({ rel: "0" });
  const startSec = toSeconds(start);
  const endSec = toSeconds(end);
  if (startSec !== undefined) params.set("start", startSec);
  if (endSec !== undefined) params.set("end", endSec);
  // youtube-nocookie : pas de cookies de suivi tant que la vidéo n'est pas lancée.
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

export default function CorpusVideo({ id, caption, site, start, end, width, align = "center" }) {
  const isInsta = ["insta", "instagram"].includes((site || "").toLowerCase());

  const alignClass = ["left", "right", "center"].includes(align) ? align : "center";

  const style = {};
  if (width) style["--corpus-video-width"] = width;

  return (
    <figure
      className={`corpus-video corpus-video--${alignClass}${isInsta ? " corpus-video--insta" : ""}`}
      style={Object.keys(style).length ? style : undefined}
    >
      {isInsta ? (
        <InstagramEmbed id={id} />
      ) : (
        <div className="corpus-video-frame">
          <iframe
            src={youtubeSrc(id, start, end)}
            title={caption || "Vidéo YouTube"}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}