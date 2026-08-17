/**
 * Diagnostic des couvertures manquantes. **N'écrit rien en base.**
 *
 * Répond à deux questions que l'écran des réglages ne sait pas distinguer :
 * combien de livres restent sans image, et lesquels les catalogues savent
 * réellement illustrer. Un livre sans ISBN et un livre que Google ignore se
 * ressemblent à l'écran, mais appellent des corrections opposées.
 *
 * La sonde passe par la vraie résolution, garde-fou d'appariement compris —
 * un diagnostic qui interrogerait les sources à sa façon finirait par
 * mesurer autre chose que ce que l'application fait.
 *
 *   npx tsx scripts/verifier-couvertures.ts [taille de l'échantillon]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const ECHANTILLON = Number(process.argv[2]) || 12;

async function main() {
  const { db } = await import("../db");
  const { livres } = await import("../db/schema");
  const { sql, isNull } = await import("drizzle-orm");
  const { resoudreCouvertures } = await import("../lib/couvertures");

  const [totaux] = await db
    .select({
      total: sql<number>`count(*)::int`,
      avecImage: sql<number>`count(*) filter (where ${livres.couvertureUrl} is not null)::int`,
      sansImageAvecIsbn: sql<number>`count(*) filter (where ${livres.couvertureUrl} is null and ${livres.isbn13} is not null and ${livres.isbn13} <> '')::int`,
      sansImageSansIsbn: sql<number>`count(*) filter (where ${livres.couvertureUrl} is null and (${livres.isbn13} is null or ${livres.isbn13} = ''))::int`,
    })
    .from(livres);

  console.log("\n— État —");
  console.log(`total                    ${String(totaux.total).padStart(4)}`);
  console.log(`avec image               ${String(totaux.avecImage).padStart(4)}`);
  console.log(`sans image, ISBN présent ${String(totaux.sansImageAvecIsbn).padStart(4)}`);
  console.log(`sans image, sans ISBN    ${String(totaux.sansImageSansIsbn).padStart(4)}  ← seule la recherche par titre les atteint`);

  const candidats = await db
    .select({
      id: livres.id,
      isbn13: livres.isbn13,
      titre: livres.titre,
      auteur: livres.auteur,
    })
    .from(livres)
    .where(isNull(livres.couvertureUrl))
    .orderBy(livres.id)
    .limit(ECHANTILLON);

  if (candidats.length === 0) {
    console.log("\nTout est illustré.");
    return;
  }

  console.log(`\n— Résolution de ${candidats.length} livres —`);
  const debut = Date.now();

  const { trouvees, substituts, examines } = await resoudreCouvertures(
    candidats.map((c) => ({
      cle: String(c.id),
      isbn13: c.isbn13 || null,
      titre: c.titre,
      auteur: c.auteur,
    })),
    // Budget large : ici on cherche à mesurer un taux de réussite, pas à
    // tenir dans la fenêtre d'une fonction serveur.
    { budgetMs: 120_000 },
  );

  const parCle = new Map(trouvees.map((c) => [c.cle, c.url]));

  for (const c of candidats.slice(0, examines)) {
    const url = parCle.get(String(c.id));
    const source = url
      ? new URL(url).host.replace(/^.*mzstatic\.com$/, "apple")
      : "—";
    console.log(
      `\n  ${c.titre.slice(0, 46).padEnd(48)} ${c.auteur.slice(0, 22)}`,
    );
    console.log(
      `  ${(c.isbn13 || "sans ISBN").padEnd(16)} ${url ? source : "aucune couverture"}`,
    );
    if (url) console.log(`  ${url.slice(0, 110)}`);
  }

  const secondes = ((Date.now() - debut) / 1000).toFixed(1);
  console.log(
    `\n— Bilan — ${trouvees.length}/${examines} illustrés, ${substituts} substitut(s) écarté(s), ${secondes} s`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
