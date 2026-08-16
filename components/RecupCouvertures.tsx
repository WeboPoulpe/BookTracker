"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Bouton } from "@/components/ui/Bouton";
import { nombre, pluriel } from "@/lib/format";

/**
 * Récupération des couvertures, à la demande, depuis les réglages.
 *
 * Elle vivait uniquement au bout du tunnel d'import, donc inatteignable une
 * fois l'import terminé — or c'est précisément après coup qu'on constate les
 * manques. Et la réponse dépend du réseau de la machine : un poste dont le
 * pare-feu coupe Open Library ne trouvera rien là où le serveur trouvera
 * beaucoup. L'action doit donc être rejouable depuis l'app déployée.
 */
export function RecupCouvertures({ manquantes }: { manquantes: number }) {
  const router = useRouter();
  const [encours, setEncours] = useState(false);
  const [bilan, setBilan] = useState<string | null>(null);

  async function lancer() {
    setEncours(true);
    setBilan("Recherche en cours…");

    let trouves = 0;
    let substituts = 0;
    let restants = manquantes;
    let curseur = 0;
    let examines = 0;

    try {
      // Vagues successives, chacune reprenant au curseur rendu par la
      // précédente : une vague qui ne trouve rien ne doit pas empêcher
      // d'atteindre les livres suivants. On s'arrête quand la vague revient
      // vide, c'est-à-dire à la fin de la bibliothèque.
      for (let vague = 0; vague < 40; vague += 1) {
        const r = await fetch(`/api/import?apres=${curseur}`, {
          method: "PATCH",
        });
        if (!r.ok) throw new Error("interrompu");
        const d = await r.json();

        if (d.traites === 0) break;

        trouves += d.trouves;
        substituts += d.substituts ?? 0;
        restants = d.restants;
        curseur = d.curseur;
        examines += d.traites;

        setBilan(
          `${pluriel(trouves, "couverture trouvée", "couvertures trouvées")} sur ${nombre(examines)} livres examinés…`,
        );
      }

      setBilan(
        `${pluriel(trouves, "couverture ajoutée", "couvertures ajoutées")}` +
          (substituts > 0
            ? `, ${nombre(substituts)} image(s) générique(s) écartée(s)`
            : "") +
          (restants > 0
            ? `. ${nombre(restants)} livres restent sans image : les catalogues ne l'ont pas. Tu peux la choisir à la main sur la fiche.`
            : ". Tout est illustré."),
      );
      router.refresh();
    } catch {
      setBilan("Recherche interrompue. Réessaie plus tard.");
    } finally {
      setEncours(false);
    }
  }

  return (
    <div className="px-4 py-3">
      <p className="text-[15px] font-medium">Couvertures manquantes</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-encre-45">
        {manquantes === 0
          ? "Tous tes livres ont une image."
          : `${pluriel(manquantes, "livre")} sans image. On la cherche par ISBN chez Open Library puis Google Books ; les vignettes génériques sont écartées.`}
      </p>

      {bilan ? (
        <p className="mt-2 text-[13px] leading-relaxed text-encre-70">{bilan}</p>
      ) : null}

      {manquantes > 0 ? (
        <div className="mt-3">
          <Bouton
            variante="doux"
            taille="sm"
            disabled={encours}
            onClick={lancer}
          >
            {encours ? "Recherche…" : "Chercher les couvertures"}
          </Bouton>
        </div>
      ) : null}
    </div>
  );
}
