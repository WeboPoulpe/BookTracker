import { sql } from "drizzle-orm";

/**
 * Sous-requêtes corrélées sur la progression de lecture.
 *
 * Écrites en SQL explicite avec des alias (`s`, `le`) plutôt qu'avec les
 * objets colonne de Drizzle : dans un template `sql`, Drizzle ne préfixe les
 * colonnes du nom de leur table que si la requête porte une jointure. Sur une
 * requête mono-table, `lectures.id` sort en `"id"` nu et entre en collision
 * avec `livres.id` — Postgres répond « column reference "id" is ambiguous ».
 *
 * Les alias suppriment la dépendance à cette heuristique : ces expressions se
 * comportent pareil dans toutes les requêtes.
 */

/** Page atteinte dans la lecture en cours (celle sans date de fin). */
export const PAGE_ATTEINTE = sql<number | null>`(
  select max(s.page_atteinte)
  from sessions s
  join lectures le on le.id = s.lecture_id
  where le.livre_id = livres.id and le.fin is null
)`;

/** Minutes cumulées sur la lecture en cours — pour les livres audio. */
export const MINUTES_CUMULEES = sql<number | null>`(
  select sum(s.minutes)
  from sessions s
  join lectures le on le.id = s.lecture_id
  where le.livre_id = livres.id and le.fin is null
)`;

/**
 * Date de fin de la dernière lecture terminée.
 *
 * C'est elle qui datte un livre sur l'étagère, et non sa date d'ajout : un
 * roman acheté en 2024 mais lu en 2026 appartient à l'étagère 2026. La date
 * d'ajout ne sert que de repli, pour les livres jamais terminés.
 */
export const DERNIERE_FIN = sql<string | null>`(
  select max(le.fin)
  from lectures le
  where le.livre_id = livres.id and le.fin is not null
)`;

/** Date de la dernière session, toutes lectures confondues. */
export const DERNIERE_SESSION = sql<string | null>`(
  select max(s.jour)
  from sessions s
  join lectures le on le.id = s.lecture_id
  where le.livre_id = livres.id
)`;
