"use client";

import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { RESSORT_AMPLE } from "@/lib/anim";

/**
 * Feuille modale (bottom sheet).
 *
 * Tout formulaire de l'app passe par là, jamais par une pleine page (§7) :
 * on garde le contexte visible derrière, et le pouce atteint les actions.
 *
 * Le glissement est confié à Motion, qui suit la vélocité : un geste vif et
 * court referme, un geste lent et long aussi, mais un frôlement hésitant
 * rappelle la feuille. Un simple seuil de distance, lui, se trompe dans les
 * deux sens.
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

  function finGlissement(_: unknown, info: PanInfo) {
    const vif = info.velocity.y > 520;
    const loin = info.offset.y > 140;
    if (vif || loin) onFermer();
  }

  if (!monte) return null;

  return createPortal(
    <AnimatePresence>
      {ouverte ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.button
            type="button"
            aria-label="Fermer"
            onClick={onFermer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-encre/30 backdrop-blur-[3px]"
          />

          <motion.div
            ref={panneau}
            role="dialog"
            aria-modal="true"
            aria-label={titre}
            tabIndex={-1}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={RESSORT_AMPLE}
            drag="y"
            // La feuille ne monte pas au-delà de sa butée ; vers le bas,
            // l'élasticité signale qu'on est en train de la refermer.
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={finGlissement}
            className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-feuille bg-papier shadow-feuille outline-none"
            style={{ paddingBottom: "var(--marge-bas)" }}
          >
            {/* Poignée : la zone de saisie du geste, et le signal qu'il existe */}
            <div className="shrink-0 cursor-grab pt-3 pb-1 active:cursor-grabbing">
              <div className="mx-auto h-1.5 w-10 rounded-pilule bg-encre-20" />
            </div>

            {titre ? (
              <h2 className="shrink-0 px-5 pt-2 pb-3 font-display text-[1.35rem] font-semibold">
                {titre}
              </h2>
            ) : null}

            <div className="zone-defilable min-h-0 flex-1 px-5 pb-4">
              {children}
            </div>

            {pied ? (
              <div className="shrink-0 border-t border-bordure px-5 pt-3 pb-3">
                {pied}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
