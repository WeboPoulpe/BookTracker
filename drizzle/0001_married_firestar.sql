CREATE TABLE "couvertures" (
	"livre_id" integer PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"donnees" text NOT NULL,
	"octets" integer NOT NULL,
	"version" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "couvertures" ADD CONSTRAINT "couvertures_livre_id_livres_id_fk" FOREIGN KEY ("livre_id") REFERENCES "public"."livres"("id") ON DELETE cascade ON UPDATE no action;