"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { SaisieRapide } from "@/components/SaisieRapide";
import { Bouton } from "@/components/ui/Bouton";
import type { Statut } from "@/db/schema";
import { RESSORT, TOUCHER } from "@/lib/anim";
import { envoyer } from "@/lib/client-api";
import { COULEUR_STATUT, LIBELLE_STATUT, ORDRE_STATUTS } from "@/lib/format";

type Livre = {
  id: number;
  titre: string;
  pages: number | null;
  dureeMinutes: number | null;
  format: "papier" | "ebook" | "audio" | null;
  statut: Statut | null;
  pageAtteinte: number | null;
  minutesCumulees: number | null;
};

export function ActionsLivre({ livre }: { livre: Livre }) {
  const router = useRouter();
  const [saisie, setSaisie] = useState(false);
  const [statut, setStatut] = useState<Statut>(livre.statut ?? "a_lire");
  const [enCours, demarrer] = useTransition();

  async function changer(nouveau: Statut) {
    if (nouveau === statut) return;
    const precedent = statut;
    // Optimiste : la pastille bouge tout de suite, on revient en arrière
    // si le serveur refuse. Sur mobile, attendre l'aller-retour se voit.
    setStatut(nouveau);

    // `id` voyage dans le corps en plus de l'URL : hors ligne, c'est le
    // corps seul qui est mis en file, et /api/sync doit savoir quoi viser.
    const r = await envoyer({
      url: `/api/livres/${livre.id}`,
      methode: "PATCH",
      file: { table: "livres", operation: "modifier" },
      corps: { id: livre.id, statut: nouveau },
    });

    if (r.statut === "erreur") {
      setStatut(precedent);
      return;
    }
    if (r.statut === "ok") demarrer(() => router.refresh());
  }

  return (
    <>
      <div className="rail-horizontal -mx-5 px-5">
        <div className="flex w-max gap-2 pb-1">
          {ORDRE_STATUTS.map((s) => {
            const actif = s === statut;
            const c = COULEUR_STATUT[s];
            return (
              <motion.button
                key={s}
                type="button"
                onClick={() => changer(s)}
                aria-pressed={actif}
                whileTap={TOUCHER}
                transition={RESSORT}
                className="relative min-h-[38px] rounded-pilule px-4 text-[13px] font-semibold whitespace-nowrap"
              >
                {actif ? (
                  <motion.span
                    layoutId="pastille-statut"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-pilule shadow-sm"
                    style={{ backgroundColor: c.fond }}
                    transition={RESSORT}
                  />
                ) : null}
                <span
                  className="relative"
                  style={{
                    color: actif ? c.texte : "#8B849F",
                  }}
                >
                  {LIBELLE_STATUT[s]}
                </span>
                {!actif ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-pilule bg-white/60 ring-1 ring-white/80 backdrop-blur-sm -z-10"
                  />
                ) : null}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <Bouton taille="lg" onClick={() => setSaisie(true)} disabled={enCours}>
          Enregistrer ma page
        </Bouton>
      </div>

      <SaisieRapide
        livre={livre}
        ouverte={saisie}
        onFermer={() => setSaisie(false)}
      />
    </>
  );
}
