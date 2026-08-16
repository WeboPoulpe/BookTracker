import Link from "next/link";

import { TableauDeBord } from "@/components/TableauDeBord";
import { EnTete } from "@/components/ui/EnTete";
import { IconeReglages } from "@/components/ui/Icones";
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
        action={
          // Réglages a quitté la tapbar au profit des statistiques : sans ce
          // point d'entrée, l'import Goodreads deviendrait introuvable.
          <Link
            href="/reglages"
            aria-label="Réglages"
            className="flex h-11 w-11 items-center justify-center rounded-pilule bg-white/70 text-encre-70 ring-1 ring-white/80 backdrop-blur-sm"
          >
            <IconeReglages className="h-[21px] w-[21px]" />
          </Link>
        }
      />
      <TableauDeBord
        donnees={donnees}
        objectif={utilisateur?.objectifAnnuel ?? 30}
      />
    </>
  );
}
