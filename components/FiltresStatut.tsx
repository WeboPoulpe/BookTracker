"use client";

import { motion } from "motion/react";
import Link from "next/link";

import type { Statut } from "@/db/schema";
import { RESSORT, TOUCHER, conteneurCascade, elementCascadeX } from "@/lib/anim";
import { LIBELLE_STATUT, ORDRE_STATUTS, nombre } from "@/lib/format";

const LienAnime = motion.create(Link);

/**
 * Rail de filtres. Défilement horizontal plutôt qu'un menu déroulant : sur
 * mobile, un rail se balaie au pouce là où un `select` ouvre une roulette
 * système qui casse le fil de la navigation.
 */
export function FiltresStatut({
  actif,
  compteurs,
  total,
}: {
  actif: Statut | "tous";
  compteurs: Record<Statut, number>;
  total: number;
}) {
  const entrees: Array<{ cle: Statut | "tous"; libelle: string; n: number }> = [
    { cle: "tous", libelle: "Tous", n: total },
    ...ORDRE_STATUTS.map((s) => ({
      cle: s,
      libelle: LIBELLE_STATUT[s],
      n: compteurs[s] ?? 0,
    })),
  ];

  return (
    <div className="rail-horizontal -mx-5 px-5">
      <motion.div
        initial="masque"
        animate="visible"
        variants={conteneurCascade(0.045)}
        className="flex w-max gap-2 pb-1"
      >
        {entrees.map(({ cle, libelle, n }) => {
          const estActif = cle === actif;
          return (
            <LienAnime
              key={cle}
              href={cle === "tous" ? "/bibliotheque" : `/bibliotheque?statut=${cle}`}
              scroll={false}
              variants={elementCascadeX}
              whileTap={TOUCHER}
              transition={RESSORT}
              aria-current={estActif ? "true" : undefined}
              className={`relative flex min-h-[38px] items-center gap-1.5 rounded-pilule px-4 text-[13px] font-semibold whitespace-nowrap ${
                estActif
                  ? "text-rose-encre"
                  : "bg-white/70 text-encre-70 ring-1 ring-white/80 backdrop-blur-sm"
              }`}
            >
              {estActif ? (
                <motion.span
                  layoutId="pastille-filtre"
                  aria-hidden="true"
                  className="degrade-dragee absolute inset-0 rounded-pilule shadow-dragee"
                  transition={RESSORT}
                />
              ) : null}
              <span className="relative">{libelle}</span>
              <span
                className={`chiffres relative text-[11px] ${estActif ? "opacity-65" : "opacity-45"}`}
              >
                {nombre(n)}
              </span>
            </LienAnime>
          );
        })}
      </motion.div>
    </div>
  );
}
