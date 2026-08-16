"use client";

import { motion } from "motion/react";
import Link from "next/link";

import type { LivreListe } from "@/db/requetes/livres";
import { RESSORT } from "@/lib/anim";
import { progression } from "@/lib/format";
import { largeurTranche, resoudreGenre } from "@/lib/genres";

const LienAnime = motion.create(Link);

/**
 * Une tranche de livre, vue de face sur l'étagère.
 *
 * Chaque propriété visuelle encode une donnée réelle (§7) — c'est ce qui
 * distingue l'étagère d'une décoration :
 *   largeur     ← nombre de pages
 *   couleur     ← genre
 *   remplissage ← progression de lecture
 *   liseré doré ← note de 5 étoiles
 */
export function Tranche({
  livre,
  rang,
}: {
  livre: LivreListe;
  /** Position dans l'étagère — pilote le décalage de la cascade */
  rang: number;
}) {
  const g = resoudreGenre(livre.genre);
  const largeur = largeurTranche(livre.pages);

  // La hauteur suit aussi la pagination, mais faiblement : sur une étagère,
  // les formats se ressemblent plus que les épaisseurs.
  const hauteur = livre.pages
    ? Math.round(150 + Math.min(60, Math.sqrt(livre.pages) * 2.1))
    : 168;

  const avance =
    livre.statut === "en_cours"
      ? progression(livre.pageAtteinte, livre.pages)
      : null;

  const cinqEtoiles = livre.note != null && livre.note >= 5;

  return (
    <LienAnime
      href={`/bibliotheque/${livre.id}`}
      title={`${livre.titre} — ${livre.auteur}`}
      // La tranche se pose depuis le bas, comme un livre qu'on range.
      initial={{ opacity: 0, y: 26, rotateZ: -4 }}
      animate={{ opacity: 1, y: 0, rotateZ: 0 }}
      // 38 ms entre chaque tranche, plafonnés : la 80ᵉ ne doit pas arriver
      // trois secondes après la première.
      transition={{ ...RESSORT, delay: Math.min(rang * 0.038, 0.9) }}
      whileTap={{ scale: 0.94, y: -6 }}
      className="relative flex shrink-0 scroll-ml-5 flex-col justify-end overflow-hidden rounded-t-[4px] origin-bottom"
      style={{
        width: `${largeur}px`,
        height: `${hauteur}px`,
        backgroundColor: g.couleur,
        color: g.encre,
        scrollSnapAlign: "start",
      }}
    >
      {/* Remplissage : la part déjà lue, depuis le bas */}
      {avance !== null ? (
        <motion.span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 bg-black/12"
          initial={{ height: 0 }}
          animate={{ height: `${Math.round(avance * 100)}%` }}
          transition={{ ...RESSORT, delay: Math.min(rang * 0.038, 0.9) + 0.2 }}
        />
      ) : null}

      {/* Nervures de reliure — le détail qui fait lire « livre » et non « barre » */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-[14%] h-px bg-black/12"
      />
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-[14%] h-px bg-black/12"
      />
      {/* Reflet vertical : donne du galbe au dos */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-black/16 via-transparent to-white/12"
      />

      {cinqEtoiles ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px] bg-dorure"
        />
      ) : null}

      {/* Titre à la verticale, comme sur un vrai dos */}
      <span
        className="relative mb-3 px-1 font-lecture text-[10px] leading-[1.1] font-medium tracking-tight"
        style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          transform: "rotate(180deg)",
          maxHeight: `${hauteur - 26}px`,
          overflow: "hidden",
        }}
      >
        {livre.titre}
      </span>
    </LienAnime>
  );
}
