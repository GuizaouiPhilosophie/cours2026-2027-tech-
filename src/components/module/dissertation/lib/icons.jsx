/** Icônes communes. `kind` : "export" (flèche vers le bas, dans un plateau) | "import" (flèche vers le haut). */
export function IoIcon({ kind }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
      {kind === "export" ? <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /> : <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />}
    </svg>
  );
}
