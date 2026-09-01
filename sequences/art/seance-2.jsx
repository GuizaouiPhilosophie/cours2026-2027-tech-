import Cours from "../../src/components/seance/Cours";

export const meta = {
  id: "seance-2",
  numero: 2,
  titre: "Réflexion sur l'œuvre et le processus créatif",
};

export default function Seance2() {
  return (
    <Cours title="Réflexion sur l'œuvre et le processus créatif">
      <p className="placeholder">
        Contenu à venir — cette séance accueillera le cours et les extraits
        de corpus associés (voir <code>CorpusText</code>).
      </p>
    </Cours>
  );
}
