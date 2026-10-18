import { createContext, useContext } from "react";

/**
 * État de l'étape « Définition », partagé entre le sujet (SubjectText), les nœuds et le Provider.
 *   entries     : { [mot]: [{ id, word, title?, text, source?, position }] }
 *                 word : mot du sujet d'où part le lien ; title : terme réellement défini (par défaut word) ;
 *                 source : id du terme du glossaire
 *   children    : { [idNœud]: { id, parent, word, text, source, position } }  (concepts associés)
 *   editable    : l'étape est l'étape en cours
 *   openWord    : (texte, clé, élément, idDéfinition?) => void ; sans id = nouvelle définition
 *   createChild : (idNœudParent, terme) => void
 *   setMenuOpen : (ouvert) => void ; remonte le sujet au-dessus des liens pendant le menu « + définition »
 */
export const DefinitionContext = createContext({
  entries: {},
  children: {},
  editable: false,
  openWord: null,
  createChild: null,
  setMenuOpen: () => {},
});

export const useDefinitions = () => useContext(DefinitionContext);
