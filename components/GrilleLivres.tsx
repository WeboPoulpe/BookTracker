"use client";

import { motion } from "motion/react";

import { CarteLivre } from "@/components/CarteLivre";
import type { LivreListe } from "@/db/requetes/livres";
import { conteneurCascade } from "@/lib/anim";

/**
 * Grille de couvertures, en cascade à l'apparition.
 *
 * Le conteneur porte l'orchestration : sans parent en `animate`, les
 * variantes des cartes ne se déclenchent jamais. Le décalage est court
 * (35 ms) — sur une grille de trois colonnes, une cascade lente donne
 * l'impression que la page rame.
 */
export function GrilleLivres({ livres }: { livres: LivreListe[] }) {
  return (
    <motion.div
      initial="masque"
      animate="visible"
      variants={conteneurCascade(0.035, 0.04)}
      className="grid grid-cols-3 gap-x-3 gap-y-5 px-5 pt-2 pb-8 sm:grid-cols-4"
    >
      {livres.map((livre, i) => (
        <CarteLivre key={livre.id} livre={livre} priorite={i < 6} />
      ))}
    </motion.div>
  );
}
