/**
 * Récupération des couvertures en ligne de commande.
 *
 * Même code que `PATCH /api/import`, mais rejouable par vagues sans garder un
 * onglet ouvert : sur une bibliothèque importée d'un coup, l'opération dure
 * plusieurs minutes et ne doit pas dépendre de la page.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

// Imports dynamiques : `db/index.ts` lit DATABASE_URL au chargement, donc il
// doit être requis APRÈS dotenv. Un import statique serait hoisté avant.
async function main() {
  const { eq, sql } = await import("drizzle-orm");
  const { db } = await import("../db");
  const { completerCouvertures } = await import("../db/requetes/import");
  const { livres, utilisateurs } = await import("../db/schema");

  const [u] = await db.select().from(utilisateurs).limit(1);
  if (!u) throw new Error("Aucun utilisateur en base.");

  const [{ avec, sans, sansIsbn }] = await db
    .select({
      avec: sql<number>`count(*) filter (where ${livres.couvertureUrl} is not null)::int`,
      sans: sql<number>`count(*) filter (where ${livres.couvertureUrl} is null and ${livres.isbn13} is not null)::int`,
      sansIsbn: sql<number>`count(*) filter (where ${livres.isbn13} is null)::int`,
    })
    .from(livres)
    .where(eq(livres.utilisateurId, u.id));

  console.log(
    `Départ : ${avec} avec couverture, ${sans} à chercher, ${sansIsbn} sans ISBN (inéligibles).`,
  );

  let vague = 0;
  let cumulTrouves = 0;
  let cumulSubstituts = 0;
  let curseur = 0;

  // Chaque vague reprend au curseur rendu par la précédente : sans ça, une
  // vague infructueuse ferait repartir la suivante sur les mêmes ISBN et la
  // fin de la bibliothèque ne serait jamais atteinte.
  for (;;) {
    vague += 1;
    const r = await completerCouvertures(u.id, curseur, 20);
    if (r.traites === 0) break;
    cumulTrouves += r.trouves;
    cumulSubstituts += r.substituts;
    curseur = r.curseur;
    console.log(
      `Vague ${vague} : ${r.trouves}/${r.traites} trouvées` +
        (r.substituts ? `, ${r.substituts} substituts écartés` : "") +
        ` — ${r.restants} sans image`,
    );
  }

  const [{ total, couvertes }] = await db
    .select({
      total: sql<number>`count(*)::int`,
      couvertes: sql<number>`count(*) filter (where ${livres.couvertureUrl} is not null)::int`,
    })
    .from(livres)
    .where(eq(livres.utilisateurId, u.id));

  console.log(
    `\nBilan : ${couvertes}/${total} livres illustrés ` +
      `(+${cumulTrouves} cette session, ${cumulSubstituts} substituts écartés).`,
  );

  const orphelins = await db
    .select({ titre: livres.titre })
    .from(livres)
    .where(
      sql`${livres.utilisateurId} = ${u.id} and ${livres.couvertureUrl} is null and ${livres.isbn13} is not null`,
    )
    .limit(12);
  if (orphelins.length) {
    console.log(
      "Sans image malgré un ISBN : " +
        orphelins.map((o) => o.titre).join(" · "),
    );
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
