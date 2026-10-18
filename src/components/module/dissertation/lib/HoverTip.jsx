import { useState } from "react";
import { createPortal } from "react-dom";
import "./hoverTip.css";

const WIDTH = 280;

function tipStyle(r) {
  const left = Math.min(Math.max(8, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - 8);
  return r.bottom > window.innerHeight - 170
    ? { left, bottom: window.innerHeight - r.top + 8 }
    : { left, top: r.bottom + 8 };
}

/**
 * Infobulle au survol (souris) ou au focus clavier. Rendue dans <body> pour
 * ne jamais être rognée par un conteneur à défilement.
 * Au tactile, rien : toucher un mot ou une pastille affiche déjà la définition.
 */
export default function HoverTip({ content, children }) {
  const [rect, setRect] = useState(null);
  const hide = () => setRect(null);

  return (
    <span
      className="dissertation-tipwrap"
      onPointerEnter={(e) => e.pointerType === "mouse" && setRect(e.currentTarget.getBoundingClientRect())}
      onPointerLeave={hide}
      onFocus={(e) => e.target.matches(":focus-visible") && setRect(e.currentTarget.getBoundingClientRect())}
      onBlur={hide}
    >
      {children}
      {rect &&
        content &&
        createPortal(
          <div className="dissertation-tip" role="tooltip" style={tipStyle(rect)}>
            {content}
          </div>,
          document.body
        )}
    </span>
  );
}
