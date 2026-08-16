import { PorteeStatistiques, Statistiques } from "@/components/Statistiques";
import { BoutonLien } from "@/components/ui/Bouton";
import { EnTete, EtatVide } from "@/components/ui/EnTete";
import { statistiques } from "@/db/requetes/statistiques";
import { pluriel } from "@/lib/format";
import { utilisateurCourantId } from "@/lib/utilisateur";

export const dynamic = "force-dynamic";
export const metadata = { title: "Statistiques · Ma Bibliothèque" };

function entier(v: string | undefined, min: number, max: number) {
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export default async function StatistiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; mois?: string }>;
}) {
  const params = await searchParams;
  const annee = entier(params.annee, 1900, 2200);
  // Un mois sans année n'a pas de sens : on l'ignore plutôt que de deviner.
  const mois = annee === null ? null : entier(params.mois, 1, 12);

  const utilisateurId = await utilisateurCourantId();
  const stats = await statistiques(utilisateurId, { annee, mois });

  return (
    <>
      <EnTete
        titre="Statistiques"
        detail={
          stats.livresLus > 0
            ? `${pluriel(stats.livresLus, "livre lu", "livres lus")}`
            : undefined
        }
      />

      <PorteeStatistiques
        portee={stats.portee}
        annees={stats.anneesDisponibles}
      />

      {stats.anneesDisponibles.length === 0 ? (
        <EtatVide
          titre="Aucune lecture terminée."
          texte="Les statistiques se construisent à partir des livres finis. Marque un livre comme lu, ou importe ta bibliothèque Goodreads avec ses dates de lecture."
          action={
            <BoutonLien href="/reglages/import" taille="sm">
              Importer Goodreads
            </BoutonLien>
          }
        />
      ) : (
        <Statistiques stats={stats} />
      )}
    </>
  );
}
