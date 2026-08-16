"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Couverture } from "@/components/Couverture";
import { RESSORT, TOUCHER } from "@/lib/anim";
import { envoyerCouverture, preparerCouverture } from "@/lib/image";

/**
 * Couverture de la fiche livre, remplaçable par appui.
 *
 * Indispensable après un import Goodreads : le CSV n'apporte aucune image et
 * les deux catalogues en laissent beaucoup de côté. Sans ça, corriger une
 * couverture obligerait à supprimer le livre et à le recréer.
 */
export function CouvertureLivre({
  livreId,
  titre,
  genre,
  url,
}: {
  livreId: number;
  titre: string;
  genre: string | null;
  url: string | null;
}) {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [travail, setTravail] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);

  async function choisir(fichier: File) {
    setTravail(true);
    setErreur(null);
    let local: string | null = null;

    try {
      const prete = await preparerCouverture(fichier);
      local = prete.apercu;
      // Aperçu immédiat : l'envoi puis le rafraîchissement serveur prennent
      // une seconde, pendant laquelle l'ancienne image resterait affichée.
      setApercu(prete.apercu);
      await envoyerCouverture(livreId, prete.blob);
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Envoi impossible.");
      if (local) {
        URL.revokeObjectURL(local);
        setApercu(null);
      }
    } finally {
      setTravail(false);
      if (champ.current) champ.current.value = "";
    }
  }

  return (
    <div className="shrink-0">
      <input
        ref={champ}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void choisir(f);
        }}
      />

      <motion.button
        type="button"
        whileTap={TOUCHER}
        transition={RESSORT}
        onClick={() => champ.current?.click()}
        disabled={travail}
        aria-label={url ? "Changer la couverture" : "Ajouter une couverture"}
        className="relative block"
      >
        {apercu ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={apercu}
            alt={`Couverture de ${titre}`}
            className="h-[178px] w-[120px] rounded-[10px] rounded-l-[4px] object-cover shadow-carte-forte"
          />
        ) : (
          <Couverture
            titre={titre}
            url={url}
            genre={genre}
            priorite
            className="h-[178px] w-[120px] shadow-carte-forte"
            sizes="120px"
          />
        )}

        {travail ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-[10px] bg-white/70 backdrop-blur-sm">
            <span className="text-[12px] font-semibold text-rose-fonce">
              Envoi…
            </span>
          </span>
        ) : null}

        {/* Une couverture manquante doit appeler l'action, pas se contenter
            d'être un repli silencieux. */}
        {!url && !apercu && !travail ? (
          <span className="absolute inset-x-1.5 bottom-1.5 rounded-pilule bg-white/90 py-1 text-center text-[10.5px] font-semibold text-rose-fonce backdrop-blur-sm">
            Ajouter une image
          </span>
        ) : null}
      </motion.button>

      {erreur ? (
        <p className="mt-1.5 max-w-[120px] text-[11px] leading-tight text-[#A8324A]">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
