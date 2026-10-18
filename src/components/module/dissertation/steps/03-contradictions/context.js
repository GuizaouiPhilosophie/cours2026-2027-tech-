import { createContext, useContext } from "react";

/** edit : (cid, élément) => void ; ouvre la bulle d'une contradiction (null si l'étape n'est pas modifiable). */
export const ContradictionContext = createContext({ edit: null });
export const useContradictions = () => useContext(ContradictionContext);
