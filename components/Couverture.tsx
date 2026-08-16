import Image from "next/image";

import { resoudreGenre } from "@/lib/genres";

/**
 * Couverture, avec repli sur une tranche générée.
 *
 * Open Library est incomplet sur le catalogue francophone (§11) : une part
 * non négligeable de la bibliothèque n'aura jamais d'image. Le repli n'est
 * donc pas un cas d'erreur, c'est un état normal — il doit être beau.
 */
export function Couverture({
  titre,
  auteur,
  url,
  genre,
  className = "",
  sizes = "(max-width: 640px) 33vw, 160px",
  priorite = false,
}: {
  titre: string;
  auteur?: string | null;
  url?: string | null;
  genre?: string | null;
  className?: string;
  sizes?: string;
  priorite?: boolean;
}) {
  const g = resoudreGenre(genre);

  return (
    <div
      className={`relative overflow-hidden rounded-[10px] rounded-l-[4px] shadow-carte ${className}`}
      style={{ backgroundColor: g.couleur, color: g.encre }}
    >
      {url ? (
        <Image
          src={url}
          alt={`Couverture de ${titre}`}
          fill
          sizes={sizes}
          priority={priorite}
          // Les couvertures importées sont déjà redimensionnées et
          // recompressées dans le navigateur : les repasser à l'optimiseur
          // ne gagnerait rien et ferait payer une transformation serveur à
          // chaque nouvelle taille demandée.
          unoptimized={url.startsWith("/api/couverture/")}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full flex-col justify-between p-2.5">
          <p className="font-lecture text-[11px] leading-tight font-medium line-clamp-4">
            {titre}
          </p>
          {auteur ? (
            <p className="text-[9px] leading-tight opacity-70 line-clamp-2">
              {auteur}
            </p>
          ) : null}
        </div>
      )}

      {/* Ombre de gouttière : sans elle, une couverture plate ne lit pas
          comme un livre posé sur une étagère. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[9%] bg-gradient-to-r from-black/22 via-black/6 to-transparent"
      />
      {/* Reflet diagonal — la lumière rasante sur un papier glacé */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/18 via-transparent to-black/8"
      />
    </div>
  );
}
