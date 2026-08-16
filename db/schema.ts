import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/* ────────────────────────────── Énumérations ────────────────────────────── */

export const statutLecture = pgEnum("statut_lecture", [
  "a_lire",
  "en_cours",
  "lu",
  "abandonne",
  "en_pause",
]);

export const formatLivre = pgEnum("format_livre", ["papier", "ebook", "audio"]);

/* ────────────────────────────── Métier ──────────────────────────────────── */

export const utilisateurs = pgTable("utilisateurs", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  nom: text("nom"),
  image: text("image"),
  objectifAnnuel: integer("objectif_annuel").default(30),
  creeLe: timestamp("cree_le", { withTimezone: true }).defaultNow(),
});

export const series = pgTable(
  "series",
  {
    id: serial("id").primaryKey(),
    utilisateurId: text("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    nom: text("nom").notNull(),
    auteur: text("auteur"),
    // null = série encore en cours de publication, on ignore le total
    tomesTotal: integer("tomes_total"),
  },
  (t) => [unique("series_utilisateur_nom_key").on(t.utilisateurId, t.nom)],
);

export const livres = pgTable(
  "livres",
  {
    id: serial("id").primaryKey(),
    utilisateurId: text("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),

    titre: text("titre").notNull(),
    auteur: text("auteur").notNull(),
    isbn13: text("isbn13"),
    couvertureUrl: text("couverture_url"),
    pages: integer("pages"),
    dureeMinutes: integer("duree_minutes"),
    format: formatLivre("format").default("papier"),

    genre: text("genre"),
    sousGenre: text("sous_genre"),

    serieId: integer("serie_id").references(() => series.id, {
      onDelete: "set null",
    }),
    // numeric : les tomes 2.5 et les préquelles existent
    tome: numeric("tome", { precision: 4, scale: 1, mode: "number" }),

    statut: statutLecture("statut").default("a_lire"),
    // colonne PAL : 0 envie → 1 bientôt → 2 suivant
    priorite: smallint("priorite").default(0),

    // 0 à 5 par demi-étoiles
    note: numeric("note", { precision: 2, scale: 1, mode: "number" }),
    // Quatre axes d'appréciation, tous facultatifs (§2). Ce qu'ils mesurent
    // est décrit dans lib/notation.ts, seule source des libellés.
    axeIntrigue: smallint("axe_intrigue"),
    axePersonnages: smallint("axe_personnages"),
    axeEmotion: smallint("axe_emotion"),
    axeThemes: smallint("axe_themes"),

    /** Quatrième de couverture — vient du catalogue ou de la saisie */
    synopsis: text("synopsis"),
    /**
     * Résumé personnel de l'intrigue, distinct du synopsis.
     * Indispensable sur une saga : deux ans séparent parfois deux tomes, et
     * la quatrième de couverture ne rappelle jamais où l'on s'est arrêté.
     */
    resume: text("resume"),
    avis: text("avis"),
    humeur: text("humeur"),
    emoji: text("emoji"),

    prix: numeric("prix", { precision: 6, scale: 2, mode: "number" }),
    dateSortie: date("date_sortie"),
    creeLe: timestamp("cree_le", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("livres_utilisateur_statut_idx").on(t.utilisateurId, t.statut),
    index("livres_serie_tome_idx").on(t.serieId, t.tome),
  ],
);

/**
 * Une ligne par lecture — c'est ce qui permet les relectures sans écraser
 * l'historique. Aucun tableur du marché ne gère ce cas.
 */
export const lectures = pgTable(
  "lectures",
  {
    id: serial("id").primaryKey(),
    livreId: integer("livre_id")
      .notNull()
      .references(() => livres.id, { onDelete: "cascade" }),
    debut: date("debut"),
    fin: date("fin"),
    abandonnee: boolean("abandonnee").default(false),
    pageFinale: integer("page_finale"),
  },
  (t) => [index("lectures_livre_idx").on(t.livreId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    lectureId: integer("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    jour: date("jour").notNull().defaultNow(),
    // on saisit le numéro qu'on a sous les yeux, pas une soustraction
    pageAtteinte: integer("page_atteinte"),
    minutes: integer("minutes"),
    noteRapide: text("note_rapide"),
  },
  (t) => [index("sessions_lecture_jour_idx").on(t.lectureId, t.jour)],
);

/**
 * Couvertures importées à la main.
 *
 * Open Library et la BnF laissent beaucoup de livres sans image, surtout en
 * français : il faut pouvoir en fournir une soi-même (§11, « prévois toujours
 * la saisie manuelle avec upload de couverture »).
 *
 * Table séparée, et non une colonne de `livres` : l'image pèse des dizaines
 * de kilo-octets et serait rapatriée par chaque requête de liste, alors que
 * les écrans n'ont besoin que d'une URL. Elle est servie par une route
 * dédiée, en cache immuable.
 *
 * Stockage en base64 plutôt qu'en `bytea` : le driver HTTP de Neon manipule
 * le binaire de façon fragile, et 33 % de volume en plus sur une image déjà
 * compressée à ~40 ko reste négligeable.
 */
export const couvertures = pgTable("couvertures", {
  livreId: integer("livre_id")
    .primaryKey()
    .references(() => livres.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  donnees: text("donnees").notNull(),
  octets: integer("octets").notNull(),
  /** Sert d'ETag : change à chaque remplacement, sinon l'ancienne image colle */
  version: text("version").notNull(),
  creeLe: timestamp("cree_le", { withTimezone: true }).defaultNow(),
});

export const citations = pgTable(
  "citations",
  {
    id: serial("id").primaryKey(),
    livreId: integer("livre_id")
      .notNull()
      .references(() => livres.id, { onDelete: "cascade" }),
    texte: text("texte").notNull(),
    page: integer("page"),
    creeLe: timestamp("cree_le", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("citations_livre_idx").on(t.livreId)],
);

/* ─────────────────────── Auth.js v5 (préfixe `auth_`) ───────────────────────
 * Préfixées pour ne pas entrer en collision avec la table `sessions` métier,
 * qui désigne ici une session de *lecture*, pas une session de connexion.
 * ------------------------------------------------------------------------- */

export const authComptes = pgTable(
  "auth_comptes",
  {
    utilisateurId: text("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const authSessions = pgTable("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  utilisateurId: text("utilisateur_id")
    .notNull()
    .references(() => utilisateurs.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const authJetons = pgTable(
  "auth_jetons",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ────────────────────────────── Relations ───────────────────────────────── */

export const utilisateursRelations = relations(utilisateurs, ({ many }) => ({
  livres: many(livres),
  series: many(series),
}));

export const seriesRelations = relations(series, ({ one, many }) => ({
  utilisateur: one(utilisateurs, {
    fields: [series.utilisateurId],
    references: [utilisateurs.id],
  }),
  livres: many(livres),
}));

export const livresRelations = relations(livres, ({ one, many }) => ({
  utilisateur: one(utilisateurs, {
    fields: [livres.utilisateurId],
    references: [utilisateurs.id],
  }),
  serie: one(series, { fields: [livres.serieId], references: [series.id] }),
  lectures: many(lectures),
  citations: many(citations),
  couverture: one(couvertures, {
    fields: [livres.id],
    references: [couvertures.livreId],
  }),
}));

export const couverturesRelations = relations(couvertures, ({ one }) => ({
  livre: one(livres, { fields: [couvertures.livreId], references: [livres.id] }),
}));

export const lecturesRelations = relations(lectures, ({ one, many }) => ({
  livre: one(livres, { fields: [lectures.livreId], references: [livres.id] }),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  lecture: one(lectures, {
    fields: [sessions.lectureId],
    references: [lectures.id],
  }),
}));

export const citationsRelations = relations(citations, ({ one }) => ({
  livre: one(livres, { fields: [citations.livreId], references: [livres.id] }),
}));

/* ────────────────────────────── Types ───────────────────────────────────── */

export type Utilisateur = typeof utilisateurs.$inferSelect;
export type Serie = typeof series.$inferSelect;
export type NouvelleSerie = typeof series.$inferInsert;
export type Livre = typeof livres.$inferSelect;
export type NouveauLivre = typeof livres.$inferInsert;
export type Lecture = typeof lectures.$inferSelect;
export type NouvelleLecture = typeof lectures.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NouvelleSession = typeof sessions.$inferInsert;
export type Citation = typeof citations.$inferSelect;
export type NouvelleCitation = typeof citations.$inferInsert;

export type Statut = (typeof statutLecture.enumValues)[number];
export type Format = (typeof formatLivre.enumValues)[number];
