import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ajouterCitation,
  changerStatut,
  creerLivre,
  enregistrerSession,
  majLivre,
  supprimerLivre,
} from "@/db/requetes/mutations";
import { corpsValide, erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";
import {
  schemaCitation,
  schemaLivre,
  schemaSession,
} from "@/lib/validation";

/**
 * Réconciliation de la file hors ligne (§8).
 *
 * Le client rejoue ses mutations une par une, dans l'ordre chronologique.
 * Chaque charge utile est **revalidée** ici : elle n'est pas passée par le
 * formulaire, elle a pu séjourner des jours dans IndexedDB, et rien ne
 * garantit qu'elle vient d'une version à jour de l'app.
 */

const schemaEnveloppe = z.object({
  table: z.enum(["livres", "sessions", "citations"]),
  operation: z.enum(["creer", "modifier", "supprimer", "session"]),
  payload: z.unknown(),
  horodatage: z.number().int().positive(),
});

const schemaModification = schemaLivre
  .partial()
  .extend({ id: z.coerce.number().int().positive() });

const schemaSuppression = z.object({
  id: z.coerce.number().int().positive(),
});

export async function POST(requete: Request) {
  const v = await corpsValide(requete, schemaEnveloppe);
  if (!v.ok) return v.reponse;

  const { table, operation, payload } = v.data;

  let utilisateurId: string;
  try {
    utilisateurId = await utilisateurCourantId();
  } catch (e) {
    console.error("POST /api/sync — utilisateur", e);
    return erreur("serveur", "Session invalide.", 500);
  }

  try {
    /* ── Livres ────────────────────────────────────────────────────────── */
    if (table === "livres") {
      if (operation === "creer") {
        const p = schemaLivre.safeParse(payload);
        if (!p.success) return erreur("validation", "Livre invalide.", 422);
        const livre = await creerLivre(utilisateurId, p.data);
        return NextResponse.json({ applique: true, livre });
      }

      if (operation === "modifier") {
        const p = schemaModification.safeParse(payload);
        if (!p.success) return erreur("validation", "Modification invalide.", 422);

        const { id, statut, ...reste } = p.data;

        if (Object.keys(reste).length > 0) {
          const maj = await majLivre(utilisateurId, id, reste);
          // Le livre a pu être supprimé pendant qu'on était hors ligne.
          // C'est un 404 définitif, pas une panne : la file doit l'abandonner
          // plutôt que le réessayer indéfiniment.
          if (!maj) return erreur("introuvable", "Livre supprimé.", 404);
        }

        const livre = statut
          ? await changerStatut(utilisateurId, id, statut)
          : await majLivre(utilisateurId, id, {});

        return NextResponse.json({ applique: true, livre });
      }

      if (operation === "supprimer") {
        const p = schemaSuppression.safeParse(payload);
        if (!p.success) return erreur("validation", "Suppression invalide.", 422);
        // Déjà supprimé = état voulu atteint. On acquitte pour vider la file.
        await supprimerLivre(utilisateurId, p.data.id);
        return NextResponse.json({ applique: true });
      }
    }

    /* ── Sessions ──────────────────────────────────────────────────────── */
    if (table === "sessions") {
      const p = schemaSession.safeParse(payload);
      if (!p.success) return erreur("validation", "Session invalide.", 422);

      const r = await enregistrerSession(utilisateurId, p.data);
      if (!r) return erreur("introuvable", "Livre supprimé.", 404);
      return NextResponse.json({ applique: true, ...r });
    }

    /* ── Citations ─────────────────────────────────────────────────────── */
    if (table === "citations") {
      const p = schemaCitation.safeParse(payload);
      if (!p.success) return erreur("validation", "Citation invalide.", 422);

      const citation = await ajouterCitation(utilisateurId, p.data);
      if (!citation) return erreur("introuvable", "Livre supprimé.", 404);
      return NextResponse.json({ applique: true, citation });
    }

    return erreur("operation_inconnue", `${table}/${operation} non gérée.`, 422);
  } catch (e) {
    console.error("POST /api/sync", e);
    return erreur("serveur", "Réconciliation impossible.", 500);
  }
}
