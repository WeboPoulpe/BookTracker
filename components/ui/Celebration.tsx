"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Célébration de fin de livre.
 *
 * Terminer un livre est l'événement le plus rare et le plus satisfaisant de
 * l'app — c'est le seul endroit qui justifie une animation spectaculaire.
 * Elle dure 2,2 s et se retire seule : une célébration qu'il faut congédier
 * devient une corvée dès la deuxième fois.
 */

const COULEURS = ["#F2C4D8", "#E0A83C", "#BBD4C4", "#A8C0E8", "#ECE4F5", "#C4638C"];

type Confetti = {
  id: number;
  x: number;
  rotation: number;
  delai: number;
  duree: number;
  couleur: string;
  taille: number;
  rond: boolean;
};

export function Celebration({
  active,
  titre,
  onFini,
}: {
  active: boolean;
  titre?: string;
  onFini: () => void;
}) {
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);

  const [reduit, setReduit] = useState(false);
  useEffect(() => {
    setReduit(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  // Générés une fois : recalculer à chaque rendu ferait sauter les confettis
  // en cours de vol.
  const confettis = useMemo<Confetti[]>(
    () =>
      Array.from({ length: 38 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        rotation: Math.random() * 720 - 360,
        delai: Math.random() * 0.35,
        duree: 1.5 + Math.random() * 0.9,
        couleur: COULEURS[i % COULEURS.length],
        taille: 6 + Math.random() * 7,
        rond: Math.random() > 0.55,
      })),
    [],
  );

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(onFini, reduit ? 1400 : 2400);
    return () => clearTimeout(t);
  }, [active, onFini, reduit]);

  if (!monte) return null;

  return createPortal(
    <AnimatePresence>
      {active ? (
        <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
          {!reduit
            ? confettis.map((c) => (
                <motion.span
                  key={c.id}
                  className="absolute top-0"
                  style={{
                    left: `${c.x}%`,
                    width: c.taille,
                    height: c.rond ? c.taille : c.taille * 1.6,
                    backgroundColor: c.couleur,
                    borderRadius: c.rond ? "50%" : "2px",
                  }}
                  initial={{ y: "-10vh", opacity: 1, rotate: 0 }}
                  animate={{ y: "110vh", opacity: [1, 1, 0], rotate: c.rotation }}
                  transition={{
                    duration: c.duree,
                    delay: c.delai,
                    ease: [0.25, 0.6, 0.5, 1],
                  }}
                />
              ))
            : null}

          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="absolute inset-x-8 top-1/3 rounded-feuille bg-white/95 px-6 py-7 text-center shadow-flottant ring-1 ring-rose-poudre backdrop-blur-xl"
          >
            <motion.span
              aria-hidden="true"
              className="block text-4xl"
              initial={{ rotate: -18, scale: 0.6 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 12, delay: 0.12 }}
            >
              ✦
            </motion.span>
            <p className="mt-3 font-display text-[1.4rem] leading-tight font-bold text-encre">
              Livre terminé
            </p>
            {titre ? (
              <p className="mt-1.5 font-lecture text-[15px] leading-snug text-encre-70">
                {titre}
              </p>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
