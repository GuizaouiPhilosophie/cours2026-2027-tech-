import Cours from "../../src/components/seance/Cours";
import CorpusText from "../../src/components/seance/CorpusText";

export const meta = {
  id: "seance-1",
  numero: 1,
  titre: "Qu'est-ce que la conscience ?",
};

export default function Seance1() {
  return (
    <Cours title="Qu'est-ce que la conscience ?">
      <p>
        La conscience désigne, dans un premier sens, la capacité qu'a un sujet
        de se représenter le monde et de se représenter lui-même comme
        agissant dans ce monde. Elle s'oppose ainsi à l'inconscience, entendue
        comme absence de représentation.
      </p>

      <CorpusText
        meta={{
          auteur: "Descartes",
          oeuvre: "Méditations métaphysiques",
          date: "1641",
        }}
      >
        <p>
          Je suppose donc que toutes les choses que je vois sont fausses ;
          je crois qu'aucune de celles que ma mémoire trompeuse me
          représente n'a jamais existé ; je pense n'avoir aucun sens ; le
          corps, la figure, l'étendue, le mouvement et le lieu ne sont que
          des fictions de mon esprit. Que sera-ce donc qui pourra être
          estimé véritable ? Peut-être seulement ceci, qu'il n'y a rien du
          tout de certain dans le monde.
        </p>
        <p>
          Mais d'où sais-je qu'il n'y a rien de différent de toutes les
          choses que je viens de mettre en revue, dont on ne puisse en
          quelque façon douter ? N'y a-t-il point quelque Dieu, ou quelque
          autre puissance qui me met en l'esprit ces mêmes pensées ?
        </p>
      </CorpusText>

      <p>
        On voit ici que le doute méthodique conduit à isoler un point fixe :
        même si tout le contenu de la conscience était douteux, l'acte même
        de douter atteste l'existence de celui qui doute.
      </p>
    </Cours>
  );
}
