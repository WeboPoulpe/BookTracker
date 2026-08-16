"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Couverture } from "@/components/Couverture";
import { RESSORT, TOUCHER } from "@/lib/anim";
import { preparerCouverture, type CouverturePreparee } from "@/lib/image";

/**
 * Choix d'une couverture : galerie ou appareil photo.
 *
 * Le §11 l'impose — « prévois toujours la saisie manuelle avec upload de
 * couverture » — parce qu'aucun des deux catalogues n'en fournit pour une
 * bonne part du fonds français.
 */
export function ChoixCouverture({
  titre,
  genre,
  urlActuelle,
  onChoisie,
  onRetiree,
}: {
  titre: string;
  genre?: string | null;
  urlActuelle: string | null;
  /** Reçoit l'image compressée ; l'envoi est décidé par le parent */
  onChoisie: (prete: CouverturePreparee) => void;
  onRetiree: () => void;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const [travail, setTravail] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [poids, setPoids] = useState<number | null>(null);

  // Les URL d'objet fuient tant qu'on ne les révoque pas : sur un écran où
  // l'on essaie plusieurs images d'affilée, ça retient chaque essai en
  // mémoire jusqu'au rechargement de la page.
  useEffect(() => {
    return () => {
      if (apercu) URL.revokeObjectURL(apercu);
    };
  }, [apercu]);

  async function choisir(fichier: File) {
    setTravail(true);
    setErreur(null);
    try {
      const prete = await preparerCouverture(fichier);
      if (apercu) URL.revokeObjectURL(apercu);
      setApercu(prete.apercu);
      setPoids(prete.blob.size);
      onChoisie(prete);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Image illisible.");
    } finally {
      setTravail(false);
      // Réinitialisé pour que rechoisir le même fichier redéclenche l'événement
      if (champ.current) champ.current.value = "";
    }
  }

  function retirer() {
    if (apercu) URL.revokeObjectURL(apercu);
    setApercu(null);
    setPoids(null);
    setErreur(null);
    onRetiree();
  }

  const affichee = apercu ?? urlActuelle;

  return (
    <div>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-encre-70">
        Couverture
      </span>

      <div className="flex gap-3">
        <div className="relative shrink-0">
          {apercu ? (
            // Aperçu local : `next/image` refuse les URL blob:, et il n'y a
            // rien à optimiser sur une image déjà compressée ici.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={apercu}
              alt="Aperçu de la couverture"
              className="h-32 w-[86px] rounded-[10px] rounded-l-[4px] object-cover shadow-carte"
            />
          ) : (
            <Couverture
              titre={titre || "Sans titre"}
              url={urlActuelle}
              genre={genre}
              className="h-32 w-[86px]"
              sizes="86px"
            />
          )}

          {travail ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-[10px] bg-white/70 backdrop-blur-sm">
              <span className="text-[11px] font-semibold text-rose-fonce">
                …
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
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
            disabled={travail}
            onClick={() => champ.current?.click()}
            className="min-h-[42px] rounded-pilule bg-rose-voile px-4 text-[13px] font-semibold text-rose-fonce ring-1 ring-rose-poudre disabled:opacity-50"
          >
            {affichee ? "Changer l'image" : "Importer une image"}
          </motion.button>

          {affichee ? (
            <motion.button
              type="button"
              whileTap={TOUCHER}
              transition={RESSORT}
              onClick={retirer}
              className="min-h-[38px] rounded-pilule px-4 text-[12.5px] font-medium text-encre-45"
            >
              Retirer
            </motion.button>
          ) : null}

          <p className="text-[11px] leading-tight text-encre-45">
            {poids
              ? `Compressée à ${Math.round(poids / 1024)} ko.`
              : "Photo ou capture. Redimensionnée automatiquement."}
          </p>
        </div>
      </div>

      {erreur ? (
        <p className="mt-2 text-[12px] text-[#A8324A]">{erreur}</p>
      ) : null}
    </div>
  );
}
