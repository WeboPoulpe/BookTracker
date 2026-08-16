"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { SaisieRapide } from "@/components/SaisieRapide";
import { Bouton } from "@/components/ui/Bouton";
import type { Statut } from "@/db/schema";
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

    try {
      const r = await fetch(`/api/livres/${livre.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: nouveau }),
      });
      if (!r.ok) throw new Error();
      demarrer(() => router.refresh());
    } catch {
      setStatut(precedent);
    }
  }

  return (
    <>
      <div className="rail-horizontal -mx-5 px-5">
        <div className="flex w-max gap-2 pb-1">
          {ORDRE_STATUTS.map((s) => {
            const actif = s === statut;
            const c = COULEUR_STATUT[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => changer(s)}
                aria-pressed={actif}
                className="min-h-[36px] rounded-pilule px-3.5 text-[13px] font-medium whitespace-nowrap transition-all active:scale-95"
                style={{
                  backgroundColor: actif ? c.fond : "transparent",
                  color: actif ? c.texte : "#7D7B95",
                  boxShadow: actif ? "none" : "inset 0 0 0 1px #E6E2EE",
                }}
              >
                {LIBELLE_STATUT[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
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
