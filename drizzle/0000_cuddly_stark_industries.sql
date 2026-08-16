CREATE TYPE "public"."format_livre" AS ENUM('papier', 'ebook', 'audio');--> statement-breakpoint
CREATE TYPE "public"."statut_lecture" AS ENUM('a_lire', 'en_cours', 'lu', 'abandonne', 'en_pause');--> statement-breakpoint
CREATE TABLE "auth_comptes" (
	"utilisateur_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "auth_comptes_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "auth_jetons" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "auth_jetons_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"utilisateur_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citations" (
	"id" serial PRIMARY KEY NOT NULL,
	"livre_id" integer NOT NULL,
	"texte" text NOT NULL,
	"page" integer,
	"cree_le" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lectures" (
	"id" serial PRIMARY KEY NOT NULL,
	"livre_id" integer NOT NULL,
	"debut" date,
	"fin" date,
	"abandonnee" boolean DEFAULT false,
	"page_finale" integer
);
--> statement-breakpoint
CREATE TABLE "livres" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" text NOT NULL,
	"titre" text NOT NULL,
	"auteur" text NOT NULL,
	"isbn13" text,
	"couverture_url" text,
	"pages" integer,
	"duree_minutes" integer,
	"format" "format_livre" DEFAULT 'papier',
	"genre" text,
	"sous_genre" text,
	"serie_id" integer,
	"tome" numeric(4, 1),
	"statut" "statut_lecture" DEFAULT 'a_lire',
	"priorite" smallint DEFAULT 0,
	"note" numeric(2, 1),
	"axe_intensite" smallint,
	"axe_emotion" smallint,
	"axe_noirceur" smallint,
	"axe_romance" smallint,
	"avis" text,
	"humeur" text,
	"emoji" text,
	"prix" numeric(6, 2),
	"date_sortie" date,
	"cree_le" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" text NOT NULL,
	"nom" text NOT NULL,
	"auteur" text,
	"tomes_total" integer,
	CONSTRAINT "series_utilisateur_nom_key" UNIQUE("utilisateur_id","nom")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lecture_id" integer NOT NULL,
	"jour" date DEFAULT now() NOT NULL,
	"page_atteinte" integer,
	"minutes" integer,
	"note_rapide" text
);
--> statement-breakpoint
CREATE TABLE "utilisateurs" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"nom" text,
	"image" text,
	"objectif_annuel" integer DEFAULT 30,
	"cree_le" timestamp with time zone DEFAULT now(),
	CONSTRAINT "utilisateurs_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auth_comptes" ADD CONSTRAINT "auth_comptes_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_livre_id_livres_id_fk" FOREIGN KEY ("livre_id") REFERENCES "public"."livres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_livre_id_livres_id_fk" FOREIGN KEY ("livre_id") REFERENCES "public"."livres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livres" ADD CONSTRAINT "livres_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livres" ADD CONSTRAINT "livres_serie_id_series_id_fk" FOREIGN KEY ("serie_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "citations_livre_idx" ON "citations" USING btree ("livre_id");--> statement-breakpoint
CREATE INDEX "lectures_livre_idx" ON "lectures" USING btree ("livre_id");--> statement-breakpoint
CREATE INDEX "livres_utilisateur_statut_idx" ON "livres" USING btree ("utilisateur_id","statut");--> statement-breakpoint
CREATE INDEX "livres_serie_tome_idx" ON "livres" USING btree ("serie_id","tome");--> statement-breakpoint
CREATE INDEX "sessions_lecture_jour_idx" ON "sessions" USING btree ("lecture_id","jour");