import type { Transition, Variants } from "motion/react";

/**
 * Vocabulaire d'animation partagé.
 *
 * Centralisé pour que tout bouge au même rythme : trois composants qui
 * choisissent chacun leur ressort donnent une app qui paraît bricolée, même
 * quand chaque animation prise isolément est réussie.
 */

/** Ressort standard — franc, sans oscillation parasite. */
export const RESSORT: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

/** Ressort rebondissant — réservé aux apparitions et aux célébrations. */
export const RESSORT_REBOND: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 20,
  mass: 0.7,
};

/** Ressort ample — panneaux et feuilles, où la masse doit se sentir. */
export const RESSORT_AMPLE: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 34,
  mass: 1,
};

/* ── Listes en cascade ───────────────────────────────────────────────────── */

export const conteneurCascade = (decalage = 0.05, retard = 0.02): Variants => ({
  masque: {},
  visible: {
    transition: { staggerChildren: decalage, delayChildren: retard },
  },
});

export const elementCascade: Variants = {
  masque: { opacity: 0, y: 18, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: RESSORT },
};

/** Variante horizontale — rails et filtres. */
export const elementCascadeX: Variants = {
  masque: { opacity: 0, x: -14 },
  visible: { opacity: 1, x: 0, transition: RESSORT },
};

/* ── Transitions de page ─────────────────────────────────────────────────── */

export const pageVariants: Variants = {
  masque: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.32, 0.72, 0, 1] } },
};

/* ── Retour tactile ──────────────────────────────────────────────────────── */

/**
 * Enfoncement au doigt. `whileTap` seul suffit sur mobile ; `whileHover` est
 * ignoré sur écran tactile, donc sans effet parasite.
 */
export const TOUCHER = { scale: 0.96 } as const;
export const TOUCHER_DOUX = { scale: 0.985 } as const;
