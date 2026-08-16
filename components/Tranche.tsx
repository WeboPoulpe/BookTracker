import Link from "next/link";

import type { LivreListe } from "@/db/requetes/livres";
import { progression } from "@/lib/format";
import { largeurTranche, resoudreGenre } from "@/lib/genres";

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
    <Link
      href={`/bibliotheque/${livre.id}`}
      title={`${livre.titre} — ${livre.auteur}`}
      className="tranche-animee group relative flex shrink-0 scroll-ml-5 flex-col justify-end overflow-hidden rounded-t-[3px] transition-transform duration-150 active:scale-[0.96]"
      style={{
        width: `${largeur}px`,
        height: `${hauteur}px`,
        backgroundColor: g.couleur,
        color: g.encre,
        // 40 ms entre chaque tranche : la cascade du §7. Plafonnée, sinon la
        // 80ᵉ tranche arriverait trois secondes après la première.
        animationDelay: `${Math.min(rang * 40, 900)}ms`,
        scrollSnapAlign: "start",
      }}
    >
      {/* Remplissage : la part déjà lue, depuis le bas */}
      {avance !== null ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 bg-black/12"
          style={{ height: `${Math.round(avance * 100)}%` }}
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
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[2px] bg-black/14"
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
    </Link>
  );
}
