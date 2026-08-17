/**
 * Diagnostic des fiches incomplètes. **N'écrit rien en base.**
 *
 * Répond à deux questions que l'écran des réglages ne sait pas distinguer :
 * combien de fiches restent incomplètes, et lesquelles les catalogues savent
 * réellement compléter. Un livre sans ISBN et un livre que Google ignore se
 * ressemblent à l'écran, mais appellent des corrections opposées.
 *
 * La sonde passe par la vraie résolution, garde-fou d'appariement compris —
 * un diagnostic qui interrogerait les sources à sa façon finirait par
 * mesurer autre chose que ce que l'application fait.
 *
 *   npx tsx scripts/verifier-fiches.ts [taille de l'échantillon]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const ECHANTILLON = Number(process.argv[2]) || 12;

async function main() {
  const { db } = await import("../db");
  const { livres } = await import("../db/schema");
  const { sql } = await import("drizzle-orm");
  const { enrichirFiches } = await import("../lib/catalogues");

  const [totaux] = await db
    .select({
      total: sql<number>`count(*)::int`,
      avecImage: sql<number>`count(*) filter (where ${livres.couvertureUrl} is not null)::int`,
      avecSynopsis: sql<number>`count(*) filter (where ${livres.synopsis} is not null and ${livres.synopsis} <> '')::int`,
      avecGenre: sql<number>`count(*) filter (where ${livres.genre} is not null and ${livres.genre} <> '')::int`,
      sansImageSansIsbn: sql<number>`count(*) filter (where ${livres.couvertureUrl} is null and (${livres.isbn13} is null or ${livres.isbn13} = ''))::int`,
    })
    .from(livres);

  console.log("\n— État —");
  console.log(`total                 ${String(totaux.total).padStart(4)}`);
  console.log(`avec image            ${String(totaux.avecImage).padStart(4)}`);
  console.log(`avec synopsis         ${String(totaux.avecSynopsis).padStart(4)}`);
  console.log(`avec genre            ${String(totaux.avecGenre).padStart(4)}`);
  console.log(
    `sans image, sans ISBN ${String(totaux.sansImageSansIsbn).padStart(4)}  ← seule la recherche par titre les atteint`,
  );

  const candidats = await db
    .select({
      id: livres.id,
      isbn13: livres.isbn13,
      titre: livres.titre,
      auteur: livres.auteur,
      couvertureUrl: livres.couvertureUrl,
      synopsis: livres.synopsis,
      genre: livres.genre,
    })
    .from(livres)
    .where(
      sql`${livres.couvertureUrl} is null
        or ${livres.synopsis} is null or ${livres.synopsis} = ''
        or ${livres.genre} is null or ${livres.genre} = ''`,
    )
    .orderBy(livres.id)
    .limit(ECHANTILLON);

  if (candidats.length === 0) {
    console.log("\nToutes les fiches sont complètes.");
    return;
  }

  console.log(`\n— Résolution de ${candidats.length} fiches —`);
  const debut = Date.now();

  const { apports, substituts, examines } = await enrichirFiches(
    candidats.map((c) => ({
      cle: String(c.id),
      isbn13: c.isbn13 || null,
      titre: c.titre,
      auteur: c.auteur,
      besoinCouverture: c.couvertureUrl === null,
      besoinSynopsis: !c.synopsis,
      besoinGenre: !c.genre,
    })),
    // Budget large : ici on cherche à mesurer un taux de réussite, pas à
    // tenir dans la fenêtre d'une fonction serveur.
    { budgetMs: 120_000 },
  );

  const parCle = new Map(apports.map((a) => [a.cle, a]));

  for (const c of candidats.slice(0, examines)) {
    const a = parCle.get(String(c.id));
    console.log(`\n  ${c.titre.slice(0, 46)} — ${c.auteur.slice(0, 22)}`);

    const image = c.couvertureUrl
      ? "déjà présente"
      : a?.couverture
        ? new URL(a.couverture.url).host
        : "introuvable";
    console.log(`    image    ${image}`);

    const texte = c.synopsis
      ? "déjà présent"
      : a?.synopsis
        ? `${a.synopsis.length} caractères — « ${a.synopsis.slice(0, 70).replace(/\s+/g, " ")}… »`
        : "introuvable";
    console.log(`    synopsis ${texte}`);

    const genre = c.genre
      ? "déjà présent"
      : a?.genre
        ? `${a.genre}${a.sousGenre ? ` · ${a.sousGenre}` : ""}`
        : "introuvable";
    console.log(`    genre    ${genre}`);
  }

  const couvertures = apports.filter((a) => a.couverture).length;
  const synopsis = apports.filter((a) => a.synopsis).length;
  const genres = apports.filter((a) => a.genre).length;
  const secondes = ((Date.now() - debut) / 1000).toFixed(1);
  console.log(
    `\n— Bilan — ${couvertures} couverture(s), ${synopsis} synopsis, ${genres} genre(s) sur ${examines} examinés, ${substituts} substitut(s) écarté(s), ${secondes} s`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
