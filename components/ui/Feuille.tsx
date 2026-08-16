"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Feuille modale (bottom sheet).
 *
 * Tout formulaire de l'app passe par là, jamais par une pleine page (§7) :
 * on garde le contexte visible derrière, et le pouce atteint les actions.
 * Glisser vers le bas referme — c'est le geste attendu sur mobile, et son
 * absence est ce qui trahit immédiatement une web-app.
 */
export function Feuille({
  ouverte,
  onFermer,
  titre,
  children,
  pied,
}: {
  ouverte: boolean;
  onFermer: () => void;
  titre?: string;
  children: ReactNode;
  pied?: ReactNode;
}) {
  const [monte, setMonte] = useState(false);
  const [decalage, setDecalage] = useState(0);
  const debut = useRef<number | null>(null);
  const panneau = useRef<HTMLDivElement>(null);

  useEffect(() => setMonte(true), []);

  // Le fond ne défile pas pendant que la feuille est ouverte
  useEffect(() => {
    if (!ouverte) return;
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = avant;
    };
  }, [ouverte]);

  // Échap ferme — l'app reste utilisable au clavier sur desktop
  useEffect(() => {
    if (!ouverte) return;
    const onTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", onTouche);
    return () => window.removeEventListener("keydown", onTouche);
  }, [ouverte, onFermer]);

  // Le focus part dans la feuille à l'ouverture, sinon le lecteur d'écran
  // continue d'annoncer la page derrière.
  useEffect(() => {
    if (ouverte) panneau.current?.focus();
  }, [ouverte]);

  const onDebut = useCallback((e: React.TouchEvent) => {
    debut.current = e.touches[0].clientY;
  }, []);

  const onGlisse = useCallback((e: React.TouchEvent) => {
    if (debut.current === null) return;
    const delta = e.touches[0].clientY - debut.current;
    // Vers le haut : rien. On ne tire pas une feuille au-delà de sa butée.
    setDecalage(Math.max(0, delta));
  }, []);

  const onFin = useCallback(() => {
    // Seuil à 110 px : assez pour ne pas fermer sur un scroll hésitant
    if (decalage > 110) onFermer();
    setDecalage(0);
    debut.current = null;
  }, [decalage, onFermer]);

  if (!monte || !ouverte) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onFermer}
        className="fondu-animee absolute inset-0 bg-encre/35 backdrop-blur-[2px]"
      />

      <div
        ref={panneau}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        tabIndex={-1}
        className="feuille-animee relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-feuille bg-papier shadow-feuille outline-none"
        style={{
          transform: decalage ? `translateY(${decalage}px)` : undefined,
          transition: decalage ? "none" : "transform 0.24s var(--ease-ios)",
          paddingBottom: "var(--marge-bas)",
        }}
      >
        {/* Poignée : la zone de saisie du geste, et le signal qu'il existe */}
        <div
          onTouchStart={onDebut}
          onTouchMove={onGlisse}
          onTouchEnd={onFin}
          className="shrink-0 cursor-grab pt-2.5 pb-1 active:cursor-grabbing"
        >
          <div className="mx-auto h-1 w-9 rounded-pilule bg-encre-20" />
        </div>

        {titre ? (
          <h2 className="shrink-0 px-5 pt-2 pb-3 font-display text-xl font-semibold">
            {titre}
          </h2>
        ) : null}

        <div className="zone-defilable min-h-0 flex-1 px-5 pb-4">{children}</div>

        {pied ? (
          <div className="shrink-0 border-t border-bordure px-5 py-3">{pied}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
