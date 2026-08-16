"use client";

import { animate, useInView, useIsomorphicLayoutEffect } from "motion/react";
import { useRef, useState } from "react";

import { nombre } from "@/lib/format";

/**
 * Nombre qui s'incrémente à l'apparition.
 *
 * Le compteur ne démarre qu'une fois la tuile à l'écran : lancé au montage,
 * il serait terminé avant qu'on ait fait défiler jusqu'à lui, et l'effet
 * serait perdu pour les statistiques du bas de page.
 */
export function Compteur({
  valeur,
  duree = 1.1,
  className,
}: {
  valeur: number;
  duree?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true, margin: "-40px" });
  const [affiche, setAffiche] = useState(0);

  useIsomorphicLayoutEffect(() => {
    if (!visible) return;

    // Au-delà d'une poignée d'unités l'incrément n'apporte rien, et sous
    // `prefers-reduced-motion` il est carrément indésirable.
    const reduit =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduit || valeur === 0) {
      setAffiche(valeur);
      return;
    }

    const controls = animate(0, valeur, {
      duration: duree,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setAffiche(Math.round(v)),
    });
    return () => controls.stop();
  }, [visible, valeur, duree]);

  return (
    <span ref={ref} className={className}>
      {nombre(affiche)}
    </span>
  );
}
