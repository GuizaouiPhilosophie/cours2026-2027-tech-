import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import SeancePage from "./pages/SeancePage";
import ExplicationPage from "./pages/ExplicationPage";

/**
 * BrowserRouter (et non HashRouter) : chaque séance a une vraie URL de
 * chemin, ex. /cours2026-2027-tech-/sequence/xxx/seance/yyy, plutôt qu'un
 * fragment (#/...). C'est nécessaire pour Hypothesis : le client associe
 * les annotations à une page via l'URI complète, mais ignore ou normalise
 * le fragment (#...) lors de la comparaison des URIs — deux séances avec
 * des hash différents finissaient donc traitées comme une seule et même
 * page, et partageaient leurs annotations (voir doc client Hypothesis sur
 * les SPA : le fragment ne doit pas servir à indiquer la route, même en
 * hash-bang #!/...).
 *
 * `basename` = import.meta.env.BASE_URL reprend automatiquement la valeur
 * de `base` définie dans vite.config.js (ex: "/cours2026-2027-tech-/"),
 * pour que les routes restent correctes qu'on soit en dev ou servi depuis
 * la sous-URL du Project Page GitHub Pages.
 *
 * Contrepartie : GitHub Pages ne sait nativement servir que des fichiers
 * statiques, donc un accès direct (ou un refresh) sur une URL du type
 * /sequence/xxx/seance/yyy renverrait un vrai 404. Voir public/404.html
 * (et le script correspondant dans index.html) qui appliquent la
 * technique "spa-github-pages" pour rediriger ces 404 vers l'app.
 */
export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sequence/:sequenceId/seance/:seanceId" element={<SeancePage />} />
        <Route path="/explication/:textId" element={<ExplicationPage />} />
      </Routes>
    </BrowserRouter>
  );
}