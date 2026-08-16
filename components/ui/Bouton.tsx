"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { RESSORT, TOUCHER } from "@/lib/anim";

type Variante = "principal" | "doux" | "fantome" | "danger";
type Taille = "sm" | "md" | "lg";

const VARIANTES: Record<Variante, string> = {
  // Dégradé plutôt qu'aplat : sur un fond lui-même dégradé, un aplat plat
  // sonne faux. L'ombre colorée fait décoller le bouton du papier.
  principal: "degrade-dragee text-rose-encre shadow-dragee font-semibold",
  doux: "bg-white/80 text-rose-fonce ring-1 ring-rose-poudre backdrop-blur-sm font-medium",
  fantome: "bg-transparent text-encre-70 font-medium",
  danger: "bg-transparent text-[#B03A5B] font-medium",
};

const TAILLES: Record<Taille, string> = {
  // min-h : la cible de 44 px du §7 est une contrainte, pas une suggestion
  sm: "min-h-[38px] px-4 text-[13px] gap-1.5 rounded-pilule",
  md: "min-h-[46px] px-5 text-[15px] gap-2 rounded-pilule",
  lg: "min-h-[54px] px-6 text-[16px] gap-2 rounded-tuile w-full",
};

function classes(variante: Variante, taille: Taille, extra?: string) {
  return [
    "inline-flex items-center justify-center",
    "disabled:pointer-events-none disabled:opacity-40",
    VARIANTES[variante],
    TAILLES[taille],
    extra ?? "",
  ].join(" ");
}

export function Bouton({
  variante = "principal",
  taille = "md",
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof motion.button>, "ref"> & {
  variante?: Variante;
  taille?: Taille;
  children: ReactNode;
}) {
  return (
    <motion.button
      whileTap={TOUCHER}
      transition={RESSORT}
      className={classes(variante, taille, className)}
      {...props}
    >
      {children}
    </motion.button>
  );
}

const LienAnime = motion.create(Link);

/**
 * Les props viennent du lien *animé*, pas de `Link` : React et Motion
 * définissent tous deux `onDrag`, avec des signatures incompatibles
 * (`DragEvent` contre `PanInfo`). Partir du type de Motion tranche le
 * conflit dans le bon sens.
 */
export function BoutonLien({
  variante = "principal",
  taille = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof LienAnime> & {
  variante?: Variante;
  taille?: Taille;
  children: ReactNode;
}) {
  return (
    <LienAnime
      whileTap={TOUCHER}
      transition={RESSORT}
      className={classes(variante, taille, className)}
      {...props}
    >
      {children}
    </LienAnime>
  );
}
