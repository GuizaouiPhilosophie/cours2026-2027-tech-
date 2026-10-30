# Exemples de dissertations terminées

Les fichiers de ce dossier apparaissent sur l'écran d'entrée de la dissertation,
dans la section « Voir un exemple terminé ». L'élève les ouvre en lecture seule
(son propre travail est mis de côté puis rendu tel quel quand il quitte l'exemple).

1. Rédigez la dissertation dans l'éditeur, puis « Exporter le poster » :
   vous obtenez un fichier `nom_prenom_dissertation.html`.
2. Déposez ce fichier ici, par exemple `beaute-objective.html`.
3. Ajoutez-le à `index.json` (le site ne peut pas lister ce dossier tout seul) :

```json
[
  { "file": "beaute-objective.html", "title": "Peut-on juger objectivement de la beauté ?" },
  { "file": "art-nature.html", "title": "L'art imite-t-il la nature ?" }
]
```

`title` est le texte affiché sur la carte. Tant que `index.json` est vide (`[]`),
la section n'apparaît pas.
