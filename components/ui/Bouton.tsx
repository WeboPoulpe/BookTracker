import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variante = "principal" | "doux" | "fantome" | "danger";
type Taille = "sm" | "md" | "lg";

const VARIANTES: Record<Variante, string> = {
  principal: "bg-encre text-velin active:bg-encre-70",
  doux: "bg-dragee text-[#5C2740] active:brightness-95",
  fantome: "bg-transparent text-encre-70 active:bg-encre/5",
  danger: "bg-transparent text-[#A8324A] active:bg-[#A8324A]/8",
};

const TAILLES: Record<Taille, string> = {
  // min-h : la cible de 44 px du §7 est une contrainte, pas une suggestion
  sm: "min-h-[38px] px-3.5 text-[13px] gap-1.5 rounded-pilule",
  md: "min-h-[44px] px-5 text-[15px] gap-2 rounded-pilule",
  lg: "min-h-[52px] px-6 text-base gap-2 rounded-carte w-full",
};

function classes(variante: Variante, taille: Taille, extra?: string) {
  return [
    "inline-flex items-center justify-center font-medium",
    "transition-[transform,background-color,filter] duration-100",
    // Le léger enfoncement au doigt : c'est ce détail qui fait « natif »
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
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
}: ComponentProps<"button"> & {
  variante?: Variante;
  taille?: Taille;
  children: ReactNode;
}) {
  return (
    <button className={classes(variante, taille, className)} {...props}>
      {children}
    </button>
  );
}

export function BoutonLien({
  variante = "principal",
  taille = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & {
  variante?: Variante;
  taille?: Taille;
  children: ReactNode;
}) {
  return (
    <Link className={classes(variante, taille, className)} {...props}>
      {children}
    </Link>
  );
}
