import { TableauDeBord } from "@/components/TableauDeBord";
import { EnTete } from "@/components/ui/EnTete";
import { heureLocale, moisCourant } from "@/lib/date";
import { tableauDeBord } from "@/db/requetes/stats";
import { utilisateurCourant } from "@/lib/utilisateur";

export const dynamic = "force-dynamic";

/**
 * Salutation selon l'heure — celle de la lectrice, pas celle du serveur.
 *
 * Calculée côté serveur, `new Date().getHours()` renverrait l'heure UTC en
 * production : la salutation serait fausse huit heures par jour.
 */
function salutation(heure = heureLocale()) {
  if (heure < 6) return "Bonne nuit";
  if (heure < 12) return "Bonjour";
  if (heure < 18) return "Bon après-midi";
  return "Bonsoir";
}

export default async function Accueil() {
  const utilisateur = await utilisateurCourant();
  const donnees = await tableauDeBord(utilisateur?.id ?? "local");

  return (
    <>
      <EnTete
        titre={`${salutation()} ${utilisateur?.nom ?? ""}`.trim()}
        detail={
          donnees.enCours.length > 0
            ? `${donnees.enCours.length} lecture${donnees.enCours.length > 1 ? "s" : ""} en cours`
            : `Année ${donnees.annee}`
        }
      />
      <TableauDeBord
        donnees={donnees}
        objectif={utilisateur?.objectifAnnuel ?? 30}
        // Calculé sur le serveur, dans le fuseau de référence : le laisser au
        // client ferait dépendre le mois surligné du réglage de l'appareil.
        moisCourant={moisCourant()}
      />
    </>
  );
}
