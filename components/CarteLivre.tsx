"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { Couverture } from "@/components/Couverture";
import type { LivreListe } from "@/db/requetes/livres";
import { RESSORT, TOUCHER, elementCascade } from "@/lib/anim";
import { libelleTome, progression } from "@/lib/format";

const LienAnime = motion.create(Link);

/** Vignette de la grille bibliothèque. Toute la carte est la cible tactile. */
export function CarteLivre({
  livre,
  priorite = false,
}: {
  livre: LivreListe;
  priorite?: boolean;
}) {
  const avance =
    livre.statut === "en_cours"
      ? progression(livre.pageAtteinte, livre.pages)
      : null;

  const tome = libelleTome(livre.tome);
  const cinqEtoiles = livre.note != null && livre.note >= 5;

  return (
    <LienAnime
      href={`/bibliotheque/${livre.id}`}
      variants={elementCascade}
      whileTap={TOUCHER}
      transition={RESSORT}
      className="flex flex-col gap-2"
    >
      <div className="relative">
        <Couverture
          titre={livre.titre}
          url={livre.couvertureUrl}
          genre={livre.genre}
          priorite={priorite}
          className="aspect-[2/3] w-full"
        />

        {avance !== null ? (
          <div className="absolute inset-x-1.5 bottom-1.5 h-2 overflow-hidden rounded-pilule bg-white/35 backdrop-blur-sm">
            <motion.div
              className="h-full rounded-pilule bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(avance * 100)}%` }}
              transition={{ ...RESSORT, delay: 0.15 }}
            />
          </div>
        ) : null}

        {livre.statut === "lu" && livre.note ? (
          <div
            className={`chiffres absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-pilule px-1.5 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-sm ${
              cinqEtoiles
                ? "bg-dorure text-[#4A3410]"
                : "bg-white/90 text-rose-encre"
            }`}
          >
            ★ {livre.note.toLocaleString("fr-FR")}
          </div>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="font-lecture text-[13.5px] leading-tight font-medium line-clamp-2">
          {livre.titre}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-encre-45">
          {livre.serieNom && tome ? `${livre.serieNom} · ${tome}` : livre.auteur}
        </p>
      </div>
    </LienAnime>
  );
}
