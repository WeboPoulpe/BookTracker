"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { pageVariants } from "@/lib/anim";

/**
 * Transition d'écran.
 *
 * `template.tsx` plutôt que `layout.tsx` : Next remonte le template à chaque
 * navigation, ce qui rejoue l'animation. Un layout, lui, persiste — et rien
 * ne bougerait.
 *
 * Volontairement bref (260 ms) et de faible amplitude : une transition qu'on
 * remarque est une transition qu'on subira des dizaines de fois par jour.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial="masque" animate="visible" variants={pageVariants}>
      {children}
    </motion.div>
  );
}
