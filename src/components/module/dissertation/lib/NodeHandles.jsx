import { Handle, Position } from "@xyflow/react";
import "./ui.css";

/**
 * Poignées invisibles qu'exige React Flow pour afficher un lien.
 * Le tracé réel est calculé par les liens eux-mêmes (lib/FloatingEdge.jsx) : tout nœud doit en contenir.
 */
export default function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} className="dissertation-handle" />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="dissertation-handle" />
    </>
  );
}
