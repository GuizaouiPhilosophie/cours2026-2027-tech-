import Cours from "../../src/components/seance/Cours";

export const meta = {
  id: "seance-3",
  numero: 3,
  titre: "Réflexion sur l'influence de la nature sur l'art",
};

export default function Seance3() {
  return (
    <Cours title="Réflexion sur l'influence de la nature sur l'art">
      <p className="placeholder">
        Contenu à venir — cette séance accueillera le cours et les extraits
        de corpus associés (voir <code>CorpusText</code>).
      </p>
    </Cours>
  );
}
