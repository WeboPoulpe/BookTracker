import { z } from "zod";

/**
 * Schémas partagés client/serveur.
 *
 * La même validation tourne dans le formulaire et dans la route API : une
 * mutation rejouée depuis la file hors ligne n'est pas passée par le
 * formulaire, elle doit donc être revalidée à l'arrivée.
 */

export const STATUTS = [
  "a_lire",
  "en_cours",
  "lu",
  "abandonne",
  "en_pause",
] as const;

export const FORMATS = ["papier", "ebook", "audio"] as const;

const texteCourt = z.string().trim().min(1).max(300);
const optionnel = <T extends z.ZodTypeAny>(s: T) =>
  s.nullish().transform((v) => (v === "" || v === undefined ? null : v));

/**
 * Champs d'un livre, **sans aucune valeur par défaut**.
 *
 * Les défauts sont ajoutés à part, uniquement pour la création. C'est
 * essentiel : `.partial()` ne neutralise pas un `.default()`, il le laisse
 * s'appliquer sur les clés absentes. Une modification partielle réécrivait
 * donc les champs qu'elle ne mentionnait même pas — noter un livre remettait
 * son statut à « à lire » et son auteur à « Auteur inconnu ».
 */
const champsLivre = z.object({
  titre: texteCourt,
  auteur: z.string().trim().max(300),
  isbn13: optionnel(z.string().trim().max(20)),
  couvertureUrl: optionnel(z.string().trim().url().max(500)),
  pages: optionnel(z.coerce.number().int().min(1).max(50_000)),
  dureeMinutes: optionnel(z.coerce.number().int().min(1).max(200_000)),
  format: z.enum(FORMATS),
  genre: optionnel(z.string().trim().max(80)),
  sousGenre: optionnel(z.string().trim().max(80)),
  serie: optionnel(z.string().trim().max(200)),
  // numeric(4,1) : les tomes 2.5 existent, au-delà d'une décimale non
  tome: optionnel(z.coerce.number().min(0).max(999).multipleOf(0.1)),
  statut: z.enum(STATUTS),
  priorite: z.coerce.number().int().min(0).max(3),
  // Demi-étoiles : 0,5 est valide, 0,3 ne l'est pas
  note: optionnel(z.coerce.number().min(0).max(5).multipleOf(0.5)),
  axeIntrigue: optionnel(z.coerce.number().int().min(0).max(5)),
  axePersonnages: optionnel(z.coerce.number().int().min(0).max(5)),
  axeEmotion: optionnel(z.coerce.number().int().min(0).max(5)),
  axeThemes: optionnel(z.coerce.number().int().min(0).max(5)),
  synopsis: optionnel(z.string().trim().max(8_000)),
  resume: optionnel(z.string().trim().max(20_000)),
  avis: optionnel(z.string().trim().max(10_000)),
  humeur: optionnel(z.string().trim().max(60)),
  emoji: optionnel(z.string().trim().max(8)),
  prix: optionnel(z.coerce.number().min(0).max(100_000)),
  dateSortie: optionnel(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

/** Création : les défauts ne s'appliquent qu'ici, sur un objet complet. */
export const schemaLivre = champsLivre.extend({
  auteur: champsLivre.shape.auteur.default("Auteur inconnu"),
  format: champsLivre.shape.format.default("papier"),
  statut: champsLivre.shape.statut.default("a_lire"),
  priorite: champsLivre.shape.priorite.default(0),
});

/**
 * Modification : tout est facultatif, et un champ absent reste inchangé en
 * base. C'est la raison d'être de la séparation ci-dessus.
 */
export const schemaLivrePartiel = champsLivre.partial();

export type EntreeLivre = z.input<typeof schemaLivre>;
export type LivreValide = z.output<typeof schemaLivre>;

export const schemaMajLivre = schemaLivrePartiel.extend({
  id: z.coerce.number().int().positive(),
});

export const schemaSession = z
  .object({
    livreId: z.coerce.number().int().positive(),
    jour: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    pageAtteinte: optionnel(z.coerce.number().int().min(0).max(50_000)),
    minutes: optionnel(z.coerce.number().int().min(1).max(1440)),
    noteRapide: optionnel(z.string().trim().max(500)),
    /** Marque la lecture comme terminée à l'enregistrement de la session */
    termine: z.coerce.boolean().default(false),
  })
  .refine((v) => v.pageAtteinte !== null || v.minutes !== null || v.termine, {
    message: "Indique une page, une durée, ou marque le livre comme terminé.",
    path: ["pageAtteinte"],
  });

export type EntreeSession = z.input<typeof schemaSession>;

export const schemaCitation = z.object({
  livreId: z.coerce.number().int().positive(),
  texte: z.string().trim().min(1).max(5000),
  page: optionnel(z.coerce.number().int().min(0).max(50_000)),
});

export const schemaStatut = z.object({
  id: z.coerce.number().int().positive(),
  statut: z.enum(STATUTS),
});
