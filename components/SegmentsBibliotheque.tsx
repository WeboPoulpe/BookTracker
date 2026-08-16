"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { RESSORT, TOUCHER } from "@/lib/anim";

const LienAnime = motion.create(Link);

const SEGMENTS = [
  { href: "/bibliotheque", libelle: "Livres" },
  { href: "/series", libelle: "Séries" },
  { href: "/citations", libelle: "Citations" },
] as const;

/**
 * Sous-navigation de la bibliothèque.
 *
 * Ces trois vues partagent un onglet de tapbar (cinq cibles maximum au
 * pouce), donc il leur faut un second niveau. L'indicateur glisse via
 * `layoutId`, comme dans la tapbar : même geste, même réponse visuelle.
 */
export function SegmentsBibliotheque({ actif }: { actif: string }) {
  return (
    <div className="rail-horizontal px-5 pb-1">
      <div className="flex w-max gap-2">
        {SEGMENTS.map((s) => {
          const estActif = s.href === actif;
          return (
            <LienAnime
              key={s.href}
              href={s.href}
              whileTap={TOUCHER}
              transition={RESSORT}
              aria-current={estActif ? "page" : undefined}
              className={`relative flex min-h-[38px] items-center rounded-pilule px-4 text-[13px] font-semibold ${
                estActif
                  ? "text-rose-encre"
                  : "bg-white/70 text-encre-70 ring-1 ring-white/80 backdrop-blur-sm"
              }`}
            >
              {estActif ? (
                <motion.span
                  layoutId="pastille-segment-biblio"
                  aria-hidden="true"
                  className="degrade-dragee absolute inset-0 rounded-pilule shadow-dragee"
                  transition={RESSORT}
                />
              ) : null}
              <span className="relative">{s.libelle}</span>
            </LienAnime>
          );
        })}
      </div>
    </div>
  );
}
