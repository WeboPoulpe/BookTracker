/**
 * Jeu de démonstration : une quarantaine de livres lus sur trois ans.
 *
 * Sert à voir les écrans peuplés — statistiques et étagère surtout — avant
 * d'avoir importé sa vraie bibliothèque. Entièrement réversible : chaque
 * livre créé porte un marqueur, et `--supprimer` ne retire que ceux-là.
 *
 *   npx tsx scripts/donnees-demo.ts --creer
 *   npx tsx scripts/donnees-demo.ts --supprimer
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, like } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../db/schema";

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });
const utilisateurId = process.env.UTILISATEUR_LOCAL_ID ?? "local";

/** Repérable en base, et visible à l'écran : rien d'ambigu à supprimer. */
const MARQUEUR = "[démo]";

type Modele = {
  titre: string;
  auteur: string;
  pages: number;
  genre: string;
  sousGenre?: string;
  format: "papier" | "ebook" | "audio";
  note: number | null;
  fin: string;
  jours: number;
};

const MODELES: Modele[] = [
  { titre: "Les sept sœurs", auteur: "Lucinda Riley", pages: 624, genre: "Contemporain", sousGenre: "Chronique familiale", format: "papier", note: 4.5, fin: "2026-01-14", jours: 12 },
  { titre: "La sœur de la tempête", auteur: "Lucinda Riley", pages: 592, genre: "Contemporain", sousGenre: "Chronique familiale", format: "papier", note: 4, fin: "2026-02-03", jours: 15 },
  { titre: "La sœur de l'ombre", auteur: "Lucinda Riley", pages: 608, genre: "Contemporain", sousGenre: "Chronique familiale", format: "ebook", note: 4, fin: "2026-03-22", jours: 18 },
  { titre: "Le chardonneret", auteur: "Donna Tartt", pages: 928, genre: "Contemporain", sousGenre: "Roman initiatique", format: "papier", note: 5, fin: "2026-04-30", jours: 34 },
  { titre: "Le maître des illusions", auteur: "Donna Tartt", pages: 704, genre: "Thriller", sousGenre: "Thriller psychologique", format: "papier", note: 4.5, fin: "2026-06-11", jours: 21 },
  { titre: "La fille du train", auteur: "Paula Hawkins", pages: 384, genre: "Thriller", sousGenre: "Domestic noir", format: "ebook", note: 3.5, fin: "2026-02-19", jours: 6 },
  { titre: "Les apparences", auteur: "Gillian Flynn", pages: 512, genre: "Thriller", sousGenre: "Domestic noir", format: "papier", note: 4, fin: "2026-05-08", jours: 9 },
  { titre: "Millénium 1", auteur: "Stieg Larsson", pages: 574, genre: "Policier", sousGenre: "Polar nordique", format: "papier", note: 4.5, fin: "2026-07-02", jours: 14 },
  { titre: "L'homme qui n'aimait pas les femmes", auteur: "Stieg Larsson", pages: 480, genre: "Policier", sousGenre: "Polar nordique", format: "audio", note: 4, fin: "2026-08-01", jours: 11 },
  { titre: "Le petit prince", auteur: "Antoine de Saint-Exupéry", pages: 96, genre: "Classique", sousGenre: "Conte", format: "papier", note: 5, fin: "2026-01-03", jours: 1 },
  { titre: "L'étranger", auteur: "Albert Camus", pages: 143, genre: "Classique", sousGenre: "Classique français", format: "papier", note: 4, fin: "2026-03-05", jours: 3 },
  { titre: "La peste", auteur: "Albert Camus", pages: 279, genre: "Classique", sousGenre: "Classique français", format: "ebook", note: 4.5, fin: "2026-06-27", jours: 8 },
  { titre: "Fourth wing", auteur: "Rebecca Yarros", pages: 704, genre: "Fantasy", sousGenre: "Romantasy", format: "ebook", note: 4, fin: "2026-04-12", jours: 7 },
  { titre: "Iron flame", auteur: "Rebecca Yarros", pages: 832, genre: "Fantasy", sousGenre: "Romantasy", format: "ebook", note: 3.5, fin: "2026-05-27", jours: 13 },
  { titre: "Le nom du vent", auteur: "Patrick Rothfuss", pages: 896, genre: "Fantasy", sousGenre: "High fantasy", format: "papier", note: 5, fin: "2026-07-25", jours: 26 },
  { titre: "Dune", auteur: "Frank Herbert", pages: 896, genre: "Science-fiction", sousGenre: "Space opera", format: "papier", note: 4.5, fin: "2025-11-18", jours: 29 },
  { titre: "La servante écarlate", auteur: "Margaret Atwood", pages: 416, genre: "Science-fiction", sousGenre: "Dystopie", format: "audio", note: 4.5, fin: "2025-09-30", jours: 10 },
  { titre: "1984", auteur: "George Orwell", pages: 376, genre: "Science-fiction", sousGenre: "Dystopie", format: "papier", note: 5, fin: "2025-04-14", jours: 9 },
  { titre: "Sapiens", auteur: "Yuval Noah Harari", pages: 512, genre: "Essai", sousGenre: "Histoire des idées", format: "audio", note: 4, fin: "2025-06-22", jours: 24 },
  { titre: "Une brève histoire du temps", auteur: "Stephen Hawking", pages: 256, genre: "Essai", sousGenre: "Sciences", format: "papier", note: 3.5, fin: "2025-02-08", jours: 16 },
  { titre: "Le pouvoir du moment présent", auteur: "Eckhart Tolle", pages: 224, genre: "Développement perso", sousGenre: "Bien-être", format: "audio", note: 3, fin: "2025-01-20", jours: 12 },
  { titre: "Into the wild", auteur: "Jon Krakauer", pages: 224, genre: "Nature", sousGenre: "Nature writing", format: "papier", note: 4, fin: "2025-08-05", jours: 5 },
  { titre: "Là où chantent les écrevisses", auteur: "Delia Owens", pages: 480, genre: "Nature", sousGenre: "Nature writing", format: "papier", note: 4.5, fin: "2025-10-11", jours: 11 },
  { titre: "Le journal d'Anne Frank", auteur: "Anne Frank", pages: 352, genre: "Biographie", sousGenre: "Journal intime", format: "papier", note: 5, fin: "2025-03-27", jours: 7 },
  { titre: "Educated", auteur: "Tara Westover", pages: 400, genre: "Biographie", sousGenre: "Mémoires", format: "ebook", note: 4.5, fin: "2025-07-16", jours: 9 },
  { titre: "Le comte de Monte-Cristo", auteur: "Alexandre Dumas", pages: 1248, genre: "Classique", sousGenre: "Classique français", format: "papier", note: 5, fin: "2025-12-28", jours: 41 },
  { titre: "Les misérables", auteur: "Victor Hugo", pages: 1488, genre: "Classique", sousGenre: "Classique français", format: "ebook", note: 4.5, fin: "2024-12-15", jours: 52 },
  { titre: "Orgueil et préjugés", auteur: "Jane Austen", pages: 432, genre: "Romance", sousGenre: "Romance historique", format: "papier", note: 4.5, fin: "2024-09-08", jours: 12 },
  { titre: "Raison et sentiments", auteur: "Jane Austen", pages: 409, genre: "Romance", sousGenre: "Romance historique", format: "ebook", note: 4, fin: "2024-10-20", jours: 14 },
  { titre: "Il est où le patron ?", auteur: "Maud Bénézit", pages: 168, genre: "BD & manga", sousGenre: "Roman graphique", format: "papier", note: 4, fin: "2024-05-11", jours: 2 },
  { titre: "Persepolis", auteur: "Marjane Satrapi", pages: 368, genre: "BD & manga", sousGenre: "Roman graphique", format: "papier", note: 5, fin: "2024-06-30", jours: 3 },
  { titre: "L'arabe du futur", auteur: "Riad Sattouf", pages: 160, genre: "BD & manga", sousGenre: "Roman graphique", format: "papier", note: 4, fin: "2024-07-14", jours: 2 },
  { titre: "Shining", auteur: "Stephen King", pages: 640, genre: "Horreur", sousGenre: "Maison hantée", format: "papier", note: 4, fin: "2024-11-02", jours: 16 },
  { titre: "Ça", auteur: "Stephen King", pages: 1138, genre: "Horreur", sousGenre: "Épouvante", format: "ebook", note: 4.5, fin: "2024-03-19", jours: 38 },
  { titre: "Misery", auteur: "Stephen King", pages: 384, genre: "Horreur", sousGenre: "Épouvante", format: "audio", note: 3.5, fin: "2024-08-23", jours: 8 },
  { titre: "Le vieux qui ne voulait pas fêter son anniversaire", auteur: "Jonas Jonasson", pages: 464, genre: "Contemporain", sousGenre: "Feel-good", format: "papier", note: 3.5, fin: "2024-02-11", jours: 10 },
  { titre: "Un homme nommé Ove", auteur: "Fredrik Backman", pages: 352, genre: "Contemporain", sousGenre: "Feel-good", format: "audio", note: 4.5, fin: "2024-04-06", jours: 6 },
  { titre: "Les cerfs-volants de Kaboul", auteur: "Khaled Hosseini", pages: 416, genre: "Historique", sousGenre: "Saga familiale", format: "papier", note: 5, fin: "2024-01-28", jours: 11 },
  { titre: "Mille soleils splendides", auteur: "Khaled Hosseini", pages: 432, genre: "Historique", sousGenre: "Saga familiale", format: "papier", note: 4.5, fin: "2025-05-19", jours: 13 },
  { titre: "Le liseur", auteur: "Bernhard Schlink", pages: 224, genre: "Historique", sousGenre: "Seconde Guerre mondiale", format: "ebook", note: 4, fin: "2026-08-09", jours: 4 },
];

function moins(iso: string, jours: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - jours);
  return d.toISOString().slice(0, 10);
}

async function creer() {
  const series = new Map<string, number>();

  for (const m of MODELES) {
    const [livre] = await db
      .insert(schema.livres)
      .values({
        utilisateurId,
        titre: `${m.titre} ${MARQUEUR}`,
        auteur: m.auteur,
        pages: m.pages,
        genre: m.genre,
        sousGenre: m.sousGenre ?? null,
        format: m.format,
        note: m.note,
        statut: "lu",
        serieId: series.get(m.auteur) ?? null,
      })
      .returning({ id: schema.livres.id });

    await db.insert(schema.lectures).values({
      livreId: livre.id,
      debut: moins(m.fin, m.jours),
      fin: m.fin,
      abandonnee: false,
      pageFinale: m.pages,
    });
  }

  console.log(`${MODELES.length} livres de démonstration créés.`);
}

async function supprimer() {
  const cibles = await db
    .select({ id: schema.livres.id })
    .from(schema.livres)
    .where(
      and(
        eq(schema.livres.utilisateurId, utilisateurId),
        like(schema.livres.titre, `%${MARQUEUR}%`),
      ),
    );

  if (cibles.length === 0) {
    console.log("Aucun livre de démonstration en base.");
    return;
  }

  // Les lectures partent en cascade avec les livres (contrainte du schéma).
  await db
    .delete(schema.livres)
    .where(
      and(
        eq(schema.livres.utilisateurId, utilisateurId),
        like(schema.livres.titre, `%${MARQUEUR}%`),
      ),
    );

  console.log(`${cibles.length} livres de démonstration supprimés.`);
}

const action = process.argv.includes("--creer")
  ? creer
  : process.argv.includes("--supprimer")
    ? supprimer
    : null;

if (!action) {
  console.log("Précise --creer ou --supprimer.");
} else {
  action().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
