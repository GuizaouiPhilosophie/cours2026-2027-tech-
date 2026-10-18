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

/** Maison : retour à l'écran de saisie du sujet. */
export function HomeIcon() {
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
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M5.5 9.5V19a1 1 0 0 0 1 1h3.5v-5.5h4V20h3.5a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}
