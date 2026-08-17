import { NextResponse } from "next/server";

import { completerFiches } from "@/db/requetes/import";
import { creerLivre } from "@/db/requetes/mutations";
import { listerLivres } from "@/db/requetes/livres";
import { corpsValide, erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";
import { schemaLivre, STATUTS } from "@/lib/validation";

// Le complètement interroge les catalogues : la fenêtre par défaut serait
// trop courte si l'un d'eux traîne.
export const maxDuration = 30;

/**
 * Délai au bout duquel on rend le livre sans attendre son complètement.
 *
 * Les catalogues répondent en ~1,5 s d'ordinaire, mais chacun a son propre
 * plafond et le pire cas les cumule. Faire patienter quinze secondes devant
 * un écran d'ajout serait pire que la fiche incomplète qu'on cherche à
 * éviter — et la passe des réglages sait la reprendre.
 */
const DELAI_COMPLETEMENT_MS = 6000;

export async function GET(requete: Request) {
  const params = new URL(requete.url).searchParams;
  const statut = params.get("statut");

  try {
    const utilisateurId = await utilisateurCourantId();
    const livres = await listerLivres(utilisateurId, {
      statut:
        statut && (STATUTS as readonly string[]).includes(statut)
          ? (statut as (typeof STATUTS)[number])
          : "tous",
      recherche: params.get("q") ?? undefined,
    });
    return NextResponse.json({ livres });
  } catch (e) {
    console.error("GET /api/livres", e);
    return erreur("serveur", "Lecture impossible.", 500);
  }
}

export async function POST(requete: Request) {
  const v = await corpsValide(requete, schemaLivre);
  if (!v.ok) return v.reponse;

  try {
    const utilisateurId = await utilisateurCourantId();
    const livre = await creerLivre(utilisateurId, v.data);

    // Complètement à la volée : couverture, synopsis et genre sont demandés
    // aux catalogues dans la foulée, plutôt que d'attendre une passe manuelle
    // depuis les réglages. Une fiche saisie à la main arrive sans image, et
    // c'est l'instant où l'on s'attend le moins à devoir aller la chercher.
    //
    // L'échec ne remonte pas : le livre est créé, c'est ce qui compte. Ce qui
    // manque restera visible dans « Compléter les fiches ».
    try {
      await Promise.race([
        completerFiches(utilisateurId, 0, 1, DELAI_COMPLETEMENT_MS, livre.id),
        new Promise((r) => setTimeout(r, DELAI_COMPLETEMENT_MS)),
      ]);
    } catch (e) {
      console.error("Complètement à l'ajout", e);
    }

    return NextResponse.json({ livre }, { status: 201 });
  } catch (e) {
    console.error("POST /api/livres", e);
    return erreur("serveur", "Création impossible.", 500);
  }
}
