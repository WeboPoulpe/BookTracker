import Image from "next/image";

import { resoudreGenre } from "@/lib/genres";

/**
 * Couverture, avec repli coloré par le genre.
 *
 * Les catalogues sont incomplets sur le fonds francophone (§11) : une part
 * non négligeable de la bibliothèque n'aura jamais d'image. Le repli n'est
 * donc pas un cas d'erreur, c'est un état normal — il doit être beau, et
 * muet : le titre et l'auteur sont toujours écrits juste à côté.
 */
export function Couverture({
  titre,
  url,
  genre,
  className = "",
  sizes = "(max-width: 640px) 33vw, 160px",
  priorite = false,
}: {
  titre: string;
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
        /* Repli sans texte : le titre et l'auteur sont toujours écrits juste
           à côté ou en dessous, et les répéter sur la vignette encombrait
           sans rien apprendre. Restent la couleur du genre et un dos de
           reliure, qui font lire « livre » plutôt que « case vide ». */
        <div
          aria-hidden="true"
          className="flex h-full items-center justify-center"
        >
          <span className="h-2/5 w-px bg-current opacity-15" />
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
