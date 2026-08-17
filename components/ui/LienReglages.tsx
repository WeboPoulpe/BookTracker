"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { IconeReglages } from "@/components/ui/Icones";
import { RESSORT, TOUCHER } from "@/lib/anim";

const LienAnime = motion.create(Link);

/**
 * Accès aux réglages, présent sur tous les écrans.
 *
 * Réglages a quitté la tapbar au profit des statistiques : sans un point
 * d'entrée permanent, l'import et l'objectif annuel ne seraient joignables
 * que depuis l'accueil, donc introuvables dès qu'on est ailleurs.
 *
 * Le lien s'efface de lui-même une fois dans les réglages : une roue qui
 * renvoie vers l'écran qu'on regarde n'est pas un raccourci, c'est un piège
 * à clic. Le test est fait ici plutôt que page par page, pour qu'un futur
 * écran en hérite sans y penser.
 */
export function LienReglages({ className = "" }: { className?: string }) {
  const chemin = usePathname();
  if (chemin?.startsWith("/reglages")) return null;

  return (
    <LienAnime
      href="/reglages"
      aria-label="Réglages"
      whileTap={TOUCHER}
      transition={RESSORT}
      className={`flex h-11 w-11 items-center justify-center rounded-pilule bg-white/70 text-encre-70 ring-1 ring-white/80 backdrop-blur-sm ${className}`}
    >
      <IconeReglages className="h-[21px] w-[21px]" />
    </LienAnime>
  );
}
