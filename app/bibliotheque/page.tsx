import { FiltresStatut } from "@/components/FiltresStatut";
import { GrilleLivres } from "@/components/GrilleLivres";
import { BoutonLien } from "@/components/ui/Bouton";
import { EnTete, EtatVide } from "@/components/ui/EnTete";
import { compterParStatut, listerLivres } from "@/db/requetes/livres";
import type { Statut } from "@/db/schema";
import { LIBELLE_STATUT, pluriel } from "@/lib/format";
import { utilisateurCourantId } from "@/lib/utilisateur";
import { STATUTS } from "@/lib/validation";

// La bibliothèque bouge à chaque ajout : pas de cache statique.
export const dynamic = "force-dynamic";

export default async function Bibliotheque({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; q?: string }>;
}) {
  const params = await searchParams;
  const statut = (STATUTS as readonly string[]).includes(params.statut ?? "")
    ? (params.statut as Statut)
    : "tous";
  const recherche = params.q?.trim() || undefined;

  const utilisateurId = await utilisateurCourantId();
  const [livres, { parStatut, total }] = await Promise.all([
    listerLivres(utilisateurId, { statut, recherche, tri: "recent" }),
    compterParStatut(utilisateurId),
  ]);

  return (
    <>
      <EnTete
        titre="Bibliothèque"
        detail={
          recherche
            ? `${pluriel(livres.length, "résultat")} pour « ${recherche} »`
            : pluriel(total, "livre")
        }
        action={
          <BoutonLien href="/bibliotheque/ajouter" taille="sm" variante="doux">
            Ajouter
          </BoutonLien>
        }
      />

      <div className="px-5">
        <FiltresStatut actif={statut} compteurs={parStatut} total={total} />
      </div>

      {livres.length === 0 ? (
        <EtatVide
          titre={
            total === 0
              ? "Aucun livre pour l'instant."
              : `Rien en « ${statut === "tous" ? "tous" : LIBELLE_STATUT[statut]} ».`
          }
          texte={
            total === 0
              ? "Importe ta bibliothèque Goodreads, ou ajoute un premier livre à la main."
              : undefined
          }
          action={
            total === 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                <BoutonLien href="/reglages/import" taille="sm">
                  Importer Goodreads
                </BoutonLien>
                <BoutonLien href="/bibliotheque/ajouter" taille="sm" variante="doux">
                  Ajouter un livre
                </BoutonLien>
              </div>
            ) : undefined
          }
        />
      ) : (
        <GrilleLivres livres={livres} />
      )}
    </>
  );
}
