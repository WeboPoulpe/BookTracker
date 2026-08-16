import { TableauDeBord } from "@/components/TableauDeBord";
import { EnTete } from "@/components/ui/EnTete";
import { tableauDeBord } from "@/db/requetes/stats";
import { utilisateurCourant } from "@/lib/utilisateur";

export const dynamic = "force-dynamic";

const BONJOUR = ["Bonne nuit", "Bonjour", "Bon après-midi", "Bonsoir"];

function salutation(heure = new Date().getHours()) {
  if (heure < 6) return BONJOUR[0];
  if (heure < 12) return BONJOUR[1];
  if (heure < 18) return BONJOUR[2];
  return BONJOUR[3];
}

export default async function Accueil() {
  const utilisateur = await utilisateurCourant();
  const stats = await tableauDeBord(utilisateur?.id ?? "local");

  return (
    <>
      <EnTete
        titre={`${salutation()} ${utilisateur?.nom ?? ""}`.trim()}
        detail={
          stats.enCours.length > 0
            ? `${stats.enCours.length} lecture${stats.enCours.length > 1 ? "s" : ""} en cours`
            : `Année ${stats.annee}`
        }
      />
      <TableauDeBord
        stats={stats}
        objectif={utilisateur?.objectifAnnuel ?? 30}
      />
    </>
  );
}
