import { eq } from "drizzle-orm";

import { db } from "@/db";
import { citations, livres } from "@/db/schema";
import type { Surlignage } from "@/lib/kindle";
import { memeTitre, normaliser } from "@/lib/texte";

/**
 * Rapproche les surlignages Kindle des livres de la bibliothèque.
 *
 * Les titres de la liseuse ne correspondent jamais tout à fait : ils portent
 * le sous-titre, la mention d'édition, parfois le tome. On apparie donc sur
 * un titre normalisé, puis par inclusion, plutôt que d'exiger l'égalité.
 */


export type Appariement = {
  titreKindle: string;
  auteurKindle: string | null;
  livreId: number | null;
  titreLivre: string | null;
  surlignages: Surlignage[];
};

/** Regroupe par titre Kindle et cherche le livre correspondant. */
export async function apparier(
  utilisateurId: string,
  surlignages: Surlignage[],
): Promise<Appariement[]> {
  const bibliotheque = await db
    .select({ id: livres.id, titre: livres.titre, auteur: livres.auteur })
    .from(livres)
    .where(eq(livres.utilisateurId, utilisateurId));

  const groupes = new Map<string, Surlignage[]>();
  for (const s of surlignages) {
    groupes.set(s.titre, [...(groupes.get(s.titre) ?? []), s]);
  }

  return [...groupes.entries()].map(([titreKindle, liste]) => {
    // Égalité normalisée d'abord, puis préfixe sur frontière de mot :
    // « Dune » doit rejoindre « Dune : le cycle », sans rejoindre
    // « Dunkerque ».
    const cle = normaliser(titreKindle);
    const partiel =
      bibliotheque.find((l) => normaliser(l.titre) === cle) ??
      bibliotheque.find((l) => memeTitre(l.titre, titreKindle));

    return {
      titreKindle,
      auteurKindle: liste[0]?.auteur ?? null,
      livreId: partiel?.id ?? null,
      titreLivre: partiel?.titre ?? null,
      surlignages: liste,
    };
  });
}

export type ResultatKindle = {
  crees: number;
  ignores: number;
  sansLivre: number;
};

export async function importerSurlignages(
  utilisateurId: string,
  appariements: Array<{ livreId: number; surlignages: Surlignage[] }>,
): Promise<ResultatKindle> {
  const resultat: ResultatKindle = { crees: 0, ignores: 0, sansLivre: 0 };
  if (appariements.length === 0) return resultat;

  const ids = appariements.map((a) => a.livreId);

  // Un seul aller-retour pour connaître l'existant : réimporter le même
  // fichier après en avoir ajouté deux surlignages ne doit pas dupliquer
  // tout le reste, et c'est le geste naturel.
  const dejaLa = await db
    .select({ livreId: citations.livreId, texte: citations.texte })
    .from(citations);

  const connues = new Set(
    dejaLa
      .filter((c) => ids.includes(c.livreId))
      .map((c) => `${c.livreId}|${normaliser(c.texte)}`),
  );

  // On revérifie l'appartenance : les identifiants viennent du client.
  const possedes = new Set(
    (
      await db
        .select({ id: livres.id })
        .from(livres)
        .where(eq(livres.utilisateurId, utilisateurId))
    ).map((l) => l.id),
  );

  const aInserer: Array<{ livreId: number; texte: string; page: number | null }> =
    [];

  for (const a of appariements) {
    if (!possedes.has(a.livreId)) {
      resultat.sansLivre += a.surlignages.length;
      continue;
    }

    for (const s of a.surlignages) {
      const cle = `${a.livreId}|${normaliser(s.texte)}`;
      if (connues.has(cle)) {
        resultat.ignores += 1;
        continue;
      }
      connues.add(cle);
      aInserer.push({ livreId: a.livreId, texte: s.texte, page: s.page });
    }
  }

  // Insertion par lots : une requête par citation sur un fichier de mille
  // surlignages saturerait le driver HTTP de Neon.
  for (let i = 0; i < aInserer.length; i += 100) {
    const lot = aInserer.slice(i, i + 100);
    await db.insert(citations).values(lot);
    resultat.crees += lot.length;
  }

  return resultat;
}
