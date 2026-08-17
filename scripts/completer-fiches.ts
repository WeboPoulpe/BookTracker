/**
 * Complètement des fiches en ligne de commande. **Écrit en base.**
 *
 * Même code que `PATCH /api/import`, mais rejouable par vagues sans garder un
 * onglet ouvert : sur une bibliothèque importée d'un coup, l'opération dure
 * plusieurs minutes et ne doit pas dépendre de la page.
 *
 * Pour seulement constater l'état sans rien écrire : scripts/verifier-fiches.ts
 *
 *   npx tsx scripts/completer-fiches.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

// Imports dynamiques : `db/index.ts` lit DATABASE_URL au chargement, donc il
// doit être requis APRÈS dotenv. Un import statique serait hoisté avant.
async function main() {
  const { eq, sql } = await import("drizzle-orm");
  const { db } = await import("../db");
  const { completerFiches } = await import("../db/requetes/import");
  const { livres, utilisateurs } = await import("../db/schema");

  const [u] = await db.select().from(utilisateurs).limit(1);
  if (!u) throw new Error("Aucun utilisateur en base.");

  const depart = await db
    .select({
      avecImage: sql<number>`count(*) filter (where ${livres.couvertureUrl} is not null)::int`,
      sansImage: sql<number>`count(*) filter (where ${livres.couvertureUrl} is null)::int`,
      sansSynopsis: sql<number>`count(*) filter (where ${livres.synopsis} is null or ${livres.synopsis} = '')::int`,
    })
    .from(livres)
    .where(eq(livres.utilisateurId, u.id));

  console.log(
    `Départ : ${depart[0].avecImage} illustrés, ${depart[0].sansImage} sans image, ${depart[0].sansSynopsis} sans synopsis.`,
  );

  let vague = 0;
  let cumulTrouves = 0;
  let cumulSynopsis = 0;
  let cumulSubstituts = 0;
  let curseur = 0;

  // Chaque vague reprend au curseur rendu par la précédente : sans ça, une
  // vague infructueuse ferait repartir la suivante sur les mêmes livres et la
  // fin de la bibliothèque ne serait jamais atteinte.
  for (;;) {
    vague += 1;
    // Budget large : en ligne de commande, aucune fenêtre d'exécution ne nous
    // coupe, et rendre la main tôt n'aurait pour effet que de multiplier les
    // vagues.
    const r = await completerFiches(u.id, curseur, 20, 120_000);
    if (r.traites === 0) break;
    cumulTrouves += r.trouves;
    cumulSynopsis += r.synopsis;
    cumulSubstituts += r.substituts;
    curseur = r.curseur;
    console.log(
      `Vague ${vague} : ${r.trouves} couverture(s), ${r.synopsis} synopsis sur ${r.traites} examinés` +
        (r.substituts ? `, ${r.substituts} substituts écartés` : "") +
        ` — ${r.restants} fiche(s) encore incomplètes`,
    );
  }

  const [fin] = await db
    .select({
      total: sql<number>`count(*)::int`,
      couvertes: sql<number>`count(*) filter (where ${livres.couvertureUrl} is not null)::int`,
      resumees: sql<number>`count(*) filter (where ${livres.synopsis} is not null and ${livres.synopsis} <> '')::int`,
    })
    .from(livres)
    .where(eq(livres.utilisateurId, u.id));

  console.log(
    `\nBilan : ${fin.couvertes}/${fin.total} illustrés, ${fin.resumees}/${fin.total} avec synopsis ` +
      `(+${cumulTrouves} image(s), +${cumulSynopsis} synopsis cette session, ${cumulSubstituts} substituts écartés).`,
  );

  const orphelins = await db
    .select({ titre: livres.titre })
    .from(livres)
    .where(
      sql`${livres.utilisateurId} = ${u.id} and (${livres.couvertureUrl} is null or ${livres.synopsis} is null or ${livres.synopsis} = '')`,
    )
    .limit(15);
  if (orphelins.length) {
    console.log(
      "Fiches encore incomplètes : " +
        orphelins.map((o) => o.titre.slice(0, 34)).join(" · "),
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
