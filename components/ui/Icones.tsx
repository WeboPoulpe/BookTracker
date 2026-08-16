import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { actif?: boolean };

/**
 * Jeu d'icônes maison, 24×24, tracé 1.75.
 * `actif` remplit la forme au lieu d'épaissir le trait : c'est la convention
 * des barres d'onglets natives, et ça reste lisible en 24 px.
 */
function Base({ children, actif, ...p }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={actif ? 2 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...p}
    >
      {children}
    </svg>
  );
}

export function IconeAccueil({ actif, ...p }: Props) {
  return (
    <Base actif={actif} {...p}>
      <path
        d="M3.5 10.5 12 3.5l8.5 7"
        fill="none"
      />
      <path
        d="M5.5 9.7V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.7"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.16 : 0}
      />
      <path d="M9.75 20.5v-5.25h4.5v5.25" />
    </Base>
  );
}

export function IconeBibliotheque({ actif, ...p }: Props) {
  return (
    <Base actif={actif} {...p}>
      <rect
        x="3.5"
        y="4"
        width="5"
        height="16"
        rx="1.2"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.16 : 0}
      />
      <rect
        x="9.75"
        y="4"
        width="4.5"
        height="16"
        rx="1.2"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.16 : 0}
      />
      <path
        d="m16.2 5.4 3.1-.83a1.2 1.2 0 0 1 1.47.85l3.02 11.3"
        transform="translate(-1.6 0.4) scale(0.92 1)"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.16 : 0}
      />
    </Base>
  );
}

export function IconeEtagere({ actif, ...p }: Props) {
  return (
    <Base actif={actif} {...p}>
      <path d="M3 20.5h18" />
      <rect
        x="4"
        y="9"
        width="3.2"
        height="9"
        rx="0.9"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.2 : 0}
      />
      <rect
        x="8.6"
        y="5.5"
        width="3.2"
        height="12.5"
        rx="0.9"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.2 : 0}
      />
      <rect
        x="13.2"
        y="11"
        width="3.2"
        height="7"
        rx="0.9"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.2 : 0}
      />
      <rect
        x="17.8"
        y="7.5"
        width="2.6"
        height="10.5"
        rx="0.9"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.2 : 0}
      />
    </Base>
  );
}

export function IconePal({ actif, ...p }: Props) {
  return (
    <Base actif={actif} {...p}>
      <rect
        x="4"
        y="15.5"
        width="16"
        height="4"
        rx="1.3"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.16 : 0}
      />
      <rect
        x="5.5"
        y="10"
        width="13"
        height="4"
        rx="1.3"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.16 : 0}
      />
      <rect
        x="7"
        y="4.5"
        width="10"
        height="4"
        rx="1.3"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.16 : 0}
      />
    </Base>
  );
}

export function IconeReglages({ actif, ...p }: Props) {
  return (
    <Base actif={actif} {...p}>
      <circle
        cx="12"
        cy="12"
        r="3"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.2 : 0}
      />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10.09 3V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </Base>
  );
}

export function IconeStats({ actif, ...p }: Props) {
  return (
    <Base actif={actif} {...p}>
      <rect
        x="3.5"
        y="12"
        width="4.2"
        height="8"
        rx="1.2"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.18 : 0}
      />
      <rect
        x="9.9"
        y="7.5"
        width="4.2"
        height="12.5"
        rx="1.2"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.18 : 0}
      />
      <rect
        x="16.3"
        y="4"
        width="4.2"
        height="16"
        rx="1.2"
        fill={actif ? "currentColor" : "none"}
        fillOpacity={actif ? 0.18 : 0}
      />
    </Base>
  );
}

export function IconePlus(p: Props) {
  return (
    <Base {...p}>
      <path d="M12 5v14M5 12h14" strokeWidth={2.25} />
    </Base>
  );
}

export function IconeRecherche(p: Props) {
  return (
    <Base {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Base>
  );
}

export function IconeRetour(p: Props) {
  return (
    <Base {...p}>
      <path d="M15 5 8 12l7 7" strokeWidth={2} />
    </Base>
  );
}

export function IconeFermer(p: Props) {
  return (
    <Base {...p}>
      <path d="M6 6 18 18M18 6 6 18" strokeWidth={2} />
    </Base>
  );
}

export function IconeEtoile({
  remplissage = 1,
  ...p
}: SVGProps<SVGSVGElement> & { remplissage?: number }) {
  // Un dégradé à arrêt net donne la demi-étoile sans dupliquer le tracé.
  const id = `etoile-${Math.round(remplissage * 100)}`;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <defs>
        <linearGradient id={id}>
          <stop offset={`${remplissage * 100}%`} stopColor="currentColor" />
          <stop offset={`${remplissage * 100}%`} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 3.5l2.6 5.62 6.15.78-4.53 4.2 1.18 6.08L12 17.2l-5.4 2.98 1.18-6.08-4.53-4.2 6.15-.78z"
        fill={`url(#${id})`}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconeLivre(p: Props) {
  return (
    <Base {...p}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
      <path d="M7.5 4v16" />
    </Base>
  );
}

export function IconeCitation(p: Props) {
  return (
    <Base {...p}>
      <path d="M9.5 6.5C7 7.5 5.5 9.8 5.5 12.5v4h5v-5.5h-3c0-1.8.9-3 2.6-3.7ZM19 6.5c-2.5 1-4 3.3-4 6v4h5v-5.5h-3c0-1.8.9-3 2.6-3.7Z" />
    </Base>
  );
}

export function IconeSerie(p: Props) {
  return (
    <Base {...p}>
      <rect x="3" y="6" width="4" height="13" rx="1" />
      <rect x="8.5" y="6" width="4" height="13" rx="1" />
      <rect x="14" y="6" width="4" height="13" rx="1" />
      <path d="M3 3.5h18" />
    </Base>
  );
}
