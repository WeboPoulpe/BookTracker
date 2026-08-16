"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { EditionLivre } from "@/components/EditionLivre";
import { FeuilleNotation } from "@/components/Notation";
import { SaisieRapide } from "@/components/SaisieRapide";
import { Bouton } from "@/components/ui/Bouton";
import { Confirmation } from "@/components/ui/Confirmation";
import type { Statut } from "@/db/schema";
import { RESSORT, TOUCHER } from "@/lib/anim";
import { envoyer } from "@/lib/client-api";
import { COULEUR_STATUT, LIBELLE_STATUT, ORDRE_STATUTS } from "@/lib/format";

type Livre = {
  id: number;
  titre: string;
  auteur: string;
  isbn13: string | null;
  pages: number | null;
  dureeMinutes: number | null;
  format: "papier" | "ebook" | "audio" | null;
  genre: string | null;
  sousGenre: string | null;
  serieNom: string | null;
  tome: number | null;
  synopsis: string | null;
  resume: string | null;
  prix: number | null;
  dateSortie: string | null;
  statut: Statut | null;
  note: number | null;
  axeIntensite: number | null;
  axeEmotion: number | null;
  axeNoirceur: number | null;
  axeRomance: number | null;
  humeur: string | null;
  emoji: string | null;
  avis: string | null;
  pageAtteinte: number | null;
  minutesCumulees: number | null;
};

export function ActionsLivre({ livre }: { livre: Livre }) {
  const router = useRouter();
  const [saisie, setSaisie] = useState(false);
  const [edition, setEdition] = useState(false);
  const [notation, setNotation] = useState(false);
  const [suppression, setSuppression] = useState(false);
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

  async function supprimer() {
    const r = await envoyer({
      url: `/api/livres/${livre.id}`,
      methode: "DELETE",
      file: { table: "livres", operation: "supprimer" },
      corps: { id: livre.id },
    });

    if (r.statut === "erreur") return;

    // `replace` et non `push` : la fiche vient d'être détruite, la laisser
    // dans l'historique mènerait à un 404 au retour arrière.
    router.replace("/bibliotheque");
    router.refresh();
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
                ) : (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-pilule bg-white/60 ring-1 ring-white/80 backdrop-blur-sm"
                  />
                )}
                <span
                  className="relative"
                  style={{ color: actif ? c.texte : "#8B849F" }}
                >
                  {LIBELLE_STATUT[s]}
                </span>
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

      <div className="mt-2.5 flex gap-2">
        <Bouton variante="doux" className="flex-1" onClick={() => setNotation(true)}>
          {livre.note != null ? "Modifier ma note" : "Noter ce livre"}
        </Bouton>
        <Bouton variante="doux" className="flex-1" onClick={() => setEdition(true)}>
          Modifier
        </Bouton>
      </div>

      <div className="mt-2 flex justify-center">
        <Bouton
          variante="danger"
          taille="sm"
          onClick={() => setSuppression(true)}
        >
          Supprimer ce livre
        </Bouton>
      </div>

      <SaisieRapide
        livre={livre}
        ouverte={saisie}
        onFermer={() => setSaisie(false)}
      />

      {/* Les feuilles sont montées à la demande : sans ça, leur état interne
          garderait les valeurs d'avant l'enregistrement à la réouverture. */}
      {notation ? (
        <FeuilleNotation
          livre={livre}
          ouverte
          onFermer={() => setNotation(false)}
          onEnregistre={() => demarrer(() => router.refresh())}
        />
      ) : null}

      {edition ? (
        <EditionLivre
          livre={livre}
          ouverte
          onFermer={() => setEdition(false)}
          onEnregistre={() => demarrer(() => router.refresh())}
        />
      ) : null}

      <Confirmation
        ouverte={suppression}
        titre="Supprimer ce livre ?"
        texte={`« ${livre.titre} » disparaîtra, avec son historique de lecture, ses sessions et ses citations. C'est irréversible.`}
        libelleAction="Supprimer"
        onConfirmer={supprimer}
        onAnnuler={() => setSuppression(false)}
      />
    </>
  );
}
