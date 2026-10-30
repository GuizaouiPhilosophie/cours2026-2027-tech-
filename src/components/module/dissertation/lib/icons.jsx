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

/** Base commune des petites icônes au trait (24 × 24, couleur du texte). */
function Svg({ size = 18, width = 2.2, children, label }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = () => (
  <Svg size={16} width={3}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const LockIcon = () => (
  <Svg size={15} width={2} label="verrouillée">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);
export const ResetIcon = () => (
  <Svg size={17} width={2}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </Svg>
);
export const RecenterIcon = () => (
  <Svg size={19} width={2}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
  </Svg>
);
export const ArrowIcon = () => (
  <Svg size={17}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const CloseIcon = () => (
  <Svg size={16} width={2.4}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const ChevronIcon = ({ dir = "left" }) => (
  <Svg size={18} width={2.4}>
    <path d={dir === "left" ? "M15 6l-6 6 6 6" : dir === "right" ? "M9 6l6 6-6 6" : "M6 9l6 6 6-6"} />
  </Svg>
);
export const PinIcon = () => (
  <Svg size={16} width={2.2}>
    <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);
export const EyeIcon = () => (
  <Svg size={16} width={2.2}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
/** Poignée de déplacement (six points). */
export const GripIcon = () => (
  <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true">
    <circle cx="3" cy="3" r="1.6" />
    <circle cx="9" cy="3" r="1.6" />
    <circle cx="3" cy="9" r="1.6" />
    <circle cx="9" cy="9" r="1.6" />
    <circle cx="3" cy="15" r="1.6" />
    <circle cx="9" cy="15" r="1.6" />
  </svg>
);
