import { del, list, put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { exportComplet } from "@/db/requetes/export";
import { erreur } from "@/lib/api";
import { aujourdhui } from "@/lib/date";
import { utilisateurCourantId } from "@/lib/utilisateur";

export const maxDuration = 60;

const DOSSIER = "sauvegardes";
/** Au-delà, on garde surtout du volume : trente jours couvrent large. */
const RETENTION_JOURS = 30;

/**
 * Sauvegarde quotidienne de la bibliothèque dans un blob.
 *
 * « Une base de données personnelle sans sauvegarde est une perte de données
 * différée » (§11). L'export existait déjà, il ne manquait que
 * l'automatisation — et le fait qu'elle ne dépende pas d'un geste humain.
 *
 * Écrit hors de Neon, délibérément : une sauvegarde stockée dans la base
 * qu'elle protège ne protège de rien.
 */
async function sauvegarder() {
  const utilisateurId = await utilisateurCourantId();
  const contenu = await exportComplet(utilisateurId);
  const jour = aujourdhui();

  const corps = JSON.stringify(contenu, null, 2);

  // Chemin déterministe : deux exécutions le même jour se remplacent au lieu
  // d'accumuler. `addRandomSuffix: false` est ce qui le permet.
  const { url, pathname } = await put(
    `${DOSSIER}/${utilisateurId}-${jour}.json`,
    corps,
    {
      access: "public",
      contentType: "application/json; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
    },
  );

  // Purge des anciennes : sans elle, une sauvegarde quotidienne accumule
  // trois cent soixante-cinq fichiers par an.
  const limite = new Date();
  limite.setDate(limite.getDate() - RETENTION_JOURS);

  const { blobs } = await list({ prefix: `${DOSSIER}/${utilisateurId}-` });
  const perimes = blobs.filter(
    (b) => b.pathname !== pathname && new Date(b.uploadedAt) < limite,
  );
  if (perimes.length > 0) await del(perimes.map((b) => b.url));

  return {
    jour,
    url,
    octets: Buffer.byteLength(corps, "utf8"),
    livres: contenu.livres.length,
    citations: contenu.citations.length,
    purgees: perimes.length,
    conservees: blobs.length - perimes.length,
  };
}

/** Déclenché par le cron Vercel. */
export async function GET(requete: Request) {
  // Vercel signe ses appels de cron avec CRON_SECRET. Sans cette
  // vérification, l'URL suffirait à déclencher la sauvegarde de n'importe où
  // — et à en révéler l'adresse publique.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const entete = requete.headers.get("authorization");
    if (entete !== `Bearer ${secret}`) {
      return erreur("non_autorise", "Appel non signé.", 401);
    }
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // On ne fait pas échouer le cron : le service n'est simplement pas encore
    // branché, et un échec quotidien noierait les vraies alertes.
    console.warn(
      "Sauvegarde ignorée : BLOB_READ_WRITE_TOKEN absent. " +
        "Crée un store Blob dans les réglages du projet Vercel.",
    );
    return NextResponse.json(
      { ignoree: true, motif: "stockage_non_configure" },
      { status: 200 },
    );
  }

  try {
    return NextResponse.json(await sauvegarder());
  } catch (e) {
    console.error("GET /api/sauvegarde", e);
    return erreur("serveur", "Sauvegarde impossible.", 500);
  }
}

/** Déclenchement manuel depuis les réglages. */
export async function POST() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return erreur(
      "stockage_non_configure",
      "Aucun stockage Blob n'est configuré. Crée un store dans les réglages du projet Vercel, puis redéploie.",
      501,
    );
  }

  try {
    return NextResponse.json(await sauvegarder());
  } catch (e) {
    console.error("POST /api/sauvegarde", e);
    return erreur("serveur", "Sauvegarde impossible.", 500);
  }
}
