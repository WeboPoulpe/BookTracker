"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  IconeAccueil,
  IconeBibliotheque,
  IconeEtagere,
  IconePal,
  IconeReglages,
} from "@/components/ui/Icones";
import { RESSORT } from "@/lib/anim";

type Onglet = {
  href: string;
  libelle: string;
  Icone: React.ComponentType<{ actif?: boolean; className?: string }>;
  /** Routes annexes qui doivent garder cet onglet allumé */
  englobe?: string[];
};

const ONGLETS: Onglet[] = [
  { href: "/", libelle: "Accueil", Icone: IconeAccueil },
  {
    href: "/bibliotheque",
    libelle: "Livres",
    Icone: IconeBibliotheque,
    // Séries et citations sont des segments de la bibliothèque, pas des
    // onglets : au-delà de cinq cibles, la barre devient illisible au pouce.
    englobe: ["/series", "/citations"],
  },
  { href: "/etagere", libelle: "Étagère", Icone: IconeEtagere },
  { href: "/pal", libelle: "PAL", Icone: IconePal },
  { href: "/reglages", libelle: "Réglages", Icone: IconeReglages },
];

function estActif(pathname: string, onglet: Onglet) {
  if (onglet.href === "/") return pathname === "/";
  const cibles = [onglet.href, ...(onglet.englobe ?? [])];
  return cibles.some((c) => pathname === c || pathname.startsWith(`${c}/`));
}

export function TapBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="relative z-40 shrink-0 px-3"
      style={{ paddingBottom: "calc(var(--marge-bas) + var(--ecart-tapbar))" }}
    >
      {/* Barre flottante plutôt que collée au bord : elle se lit comme un
          objet posé sur le contenu, et le dégradé de fond continue dessous. */}
      <ul className="givre flex items-stretch rounded-[1.6rem] px-1.5 shadow-flottant ring-1 ring-white/60">
        {ONGLETS.map((onglet) => {
          const actif = estActif(pathname, onglet);
          const { Icone } = onglet;

          return (
            <li key={onglet.href} className="flex-1">
              <Link
                href={onglet.href}
                aria-current={actif ? "page" : undefined}
                className="relative flex h-[var(--h-tapbar)] flex-col items-center justify-center gap-1"
              >
                {/* layoutId : Motion interpole la pastille d'un onglet à
                    l'autre au lieu de la faire disparaître puis réapparaître.
                    C'est ce glissement qui fait « natif ». */}
                {actif ? (
                  <motion.span
                    layoutId="pastille-onglet"
                    aria-hidden="true"
                    className="degrade-dragee absolute inset-x-1 inset-y-2 rounded-[1.15rem] shadow-dragee"
                    transition={RESSORT}
                  />
                ) : null}

                <motion.span
                  className="relative"
                  animate={{ y: actif ? -1 : 0, scale: actif ? 1.06 : 1 }}
                  whileTap={{ scale: 0.88 }}
                  transition={RESSORT}
                >
                  <Icone
                    actif={actif}
                    className={`h-[22px] w-[22px] transition-colors duration-200 ${
                      actif ? "text-rose-encre" : "text-encre-45"
                    }`}
                  />
                </motion.span>

                <span
                  className={`relative text-[10px] leading-none tracking-tight transition-colors duration-200 ${
                    actif
                      ? "font-semibold text-rose-encre"
                      : "font-medium text-encre-45"
                  }`}
                >
                  {onglet.libelle}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
