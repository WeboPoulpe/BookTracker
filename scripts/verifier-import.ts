/**
 * Contrôle du parseur Goodreads sur les cas qui font perdre des données.
 *
 *   npx tsx scripts/verifier-import.ts
 */
import { analyser, nettoyerIsbn, normaliserDate } from "../lib/goodreads";

const CSV = [
  'Book Id,Title,Author,ISBN,ISBN13,My Rating,Publisher,Binding,Number of Pages,Year Published,Date Read,Date Added,Bookshelves,Exclusive Shelf,My Review,Read Count',
  '1,"Le Palais des vents (Les Sept Sœurs, #4)","Lucinda Riley","=""2365593828""","=""9782365593823""",5,Charleston,Paperback,624,2018,2024/03/15,2024/01/02,"favoris",read,"Bouleversant.",1',
  '2,"La Sœur perdue (Les Sept Sœurs, #7)","Lucinda Riley","","=""9782368126998""",0,Charleston,Paperback,752,2021,,2025/06/01,"",currently-reading,"",0',
  '3,"Un livre lâché","Autrice X","","",0,,Kindle Edition,300,2020,,2023/05/10,"dnf, abandoned",read,"Pas accroché.",1',
  '4,"Une saga en pause (Machin, #2.5)","Auteur Y","","",4,,Audio CD,,2019,,2024/11/20,"on-hold",currently-reading,"",0',
  '5,"",“Sans titre”,"","",0,,,,,,,"",to-read,"",0',
].join("\n");

const a = analyser(CSV);

console.log("Colonnes manquantes :", a.colonnesManquantes.length ? a.colonnesManquantes : "aucune");
console.log("Lignes lues :", a.total, "· retenues :", a.livres.length, "· rejetées :", a.rejets.length);
console.log("Rejets :", a.rejets);
console.log();

for (const l of a.livres) {
  console.log(
    [
      l.titre.padEnd(24).slice(0, 24),
      `série=${l.serie ?? "—"}`,
      `tome=${l.tome ?? "—"}`,
      `statut=${l.statut}`,
      `note=${l.note ?? "null"}`,
      `isbn=${l.isbn13 ?? "—"}`,
      `pages=${l.pages ?? "—"}`,
      `format=${l.format}`,
      `lu=${l.dateLecture ?? "—"}`,
    ].join("  "),
  );
}

console.log("\n--- contrôles ---");
const controles: Array<[string, boolean]> = [
  ["ISBN =\"...\" nettoyé", nettoyerIsbn('="9782365593823"') === "9782365593823"],
  ["ISBN trop court rejeté", nettoyerIsbn('="123"') === null],
  ["Date 2024/03/15 normalisée", normaliserDate("2024/03/15") === "2024-03-15"],
  ["Date vide → null", normaliserDate("") === null],
  ["My Rating 0 → null, pas zéro", a.livres[1]?.note === null],
  ["My Rating 5 conservé", a.livres[0]?.note === 5],
  ["Série extraite du titre", a.livres[0]?.serie === "Les Sept Sœurs"],
  ["Tome 4 extrait", a.livres[0]?.tome === 4],
  ["Tome décimal 2.5 extrait", a.livres[3]?.tome === 2.5],
  ["Titre nettoyé de la série", a.livres[0]?.titre === "Le Palais des vents"],
  ["dnf/abandoned → abandonne", a.livres[2]?.statut === "abandonne"],
  ["on-hold → en_pause", a.livres[3]?.statut === "en_pause"],
  ["currently-reading → en_cours", a.livres[1]?.statut === "en_cours"],
  ["read → lu", a.livres[0]?.statut === "lu"],
  ["Kindle → ebook", a.livres[2]?.format === "ebook"],
  ["Audio CD → audio", a.livres[3]?.format === "audio"],
  ["Ligne sans titre rejetée", a.rejets.length === 1],
];

let echecs = 0;
for (const [nom, ok] of controles) {
  console.log(`${ok ? "✓" : "✗"} ${nom}`);
  if (!ok) echecs += 1;
}

console.log(`\n${controles.length - echecs}/${controles.length} contrôles passés.`);
if (echecs) process.exitCode = 1;
