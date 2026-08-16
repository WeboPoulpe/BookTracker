import Link from "next/link";

import { Couverture } from "@/components/Couverture";
import type { LivreListe } from "@/db/requetes/livres";
import { libelleTome, progression } from "@/lib/format";

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

  return (
    <Link
      href={`/bibliotheque/${livre.id}`}
      className="group flex flex-col gap-2 transition-transform duration-150 active:scale-[0.97]"
    >
      <div className="relative">
        <Couverture
          titre={livre.titre}
          auteur={livre.auteur}
          url={livre.couvertureUrl}
          genre={livre.genre}
          priorite={priorite}
          className="aspect-[2/3] w-full"
        />

        {avance !== null ? (
          <div className="absolute inset-x-1.5 bottom-1.5 h-1.5 overflow-hidden rounded-pilule bg-encre/25 backdrop-blur-sm">
            <div
              className="h-full rounded-pilule bg-velin"
              style={{ width: `${Math.round(avance * 100)}%` }}
            />
          </div>
        ) : null}

        {livre.statut === "lu" && livre.note ? (
          <div className="chiffres absolute top-1.5 right-1.5 rounded-pilule bg-encre/80 px-1.5 py-0.5 text-[10px] font-semibold text-velin backdrop-blur-sm">
            {livre.note.toLocaleString("fr-FR")}
          </div>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="font-lecture text-[13px] leading-tight font-medium line-clamp-2">
          {livre.titre}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-encre-45">
          {livre.serieNom && tome ? `${livre.serieNom} · ${tome}` : livre.auteur}
        </p>
      </div>
    </Link>
  );
}
