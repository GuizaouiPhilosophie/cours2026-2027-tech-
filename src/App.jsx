import { HashRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import SeancePage from "./pages/SeancePage";

/**
 * HashRouter (plutôt que BrowserRouter) : les URLs prennent la forme
 * /#/sequence/xxx/seance/yyy. C'est un peu moins "propre" visuellement,
 * mais ça évite tout problème de routing sur GitHub Pages (qui ne sait pas
 * rediriger /sequence/xxx vers index.html sans config supplémentaire).
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sequence/:sequenceId/seance/:seanceId" element={<SeancePage />} />
      </Routes>
    </HashRouter>
  );
}