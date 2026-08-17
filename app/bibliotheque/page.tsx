import Link from "next/link";

import { FiltresStatut } from "@/components/FiltresStatut";
import { GrilleLivres } from "@/components/GrilleLivres";
import { RechercheBibliotheque } from "@/components/RechercheBibliotheque";
import { BoutonLien } from "@/components/ui/Bouton";
import { EnTete, EtatVide } from "@/components/ui/EnTete";
import { IconeRetour } from "@/components/ui/Icones";
import { compterParStatut, listerLivres, type FiltresLivres } from "@/db/requetes/livres";
import type { Statut } from "@/db/schema";
import { LONGUEURS } from "@/db/requetes/statistiques";
import { LIBELLE_STATUT, pluriel } from "@/lib/format";
import { utilisateurCourantId } from "@/lib/utilisateur";
import { FORMATS, STATUTS } from "@/lib/validation";

// La bibliothèque bouge à chaque ajout : pas de cache statique.
export const dynamic = "force-dynamic";

const MOIS_LONGS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const LIBELLE_FORMAT: Record<string, string> = {
  papier: "Papier",
  ebook: "Numérique",
  audio: "Audio",
};

type Params = {
  statut?: string;
  q?: string;
  annee?: string;
  mois?: string;
  genre?: string;
  format?: string;
  note?: string;
  pages?: string;
  auteur?: string;
  lu?: string;
  retour?: string;
};

/**
 * Valide la destination de retour transmise en paramètre.
 *
 * On n'accepte qu'un chemin interne : sans ce garde-fou, un lien forgé
 * pourrait faire pointer le bouton vers un site tiers depuis une page de
 * l'app. `//` est rejeté car un navigateur y lit une URL absolue.
 */
function retourSur(valeur: string | undefined): string | null {
  if (!valeur) return null;
  if (!valeur.startsWith("/") || valeur.startsWith("//")) return null;
  return valeur;
}

function entier(v: string | undefined, min: number, max: number) {
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

/**
 * Traduit les paramètres d'URL en filtres, et en étiquettes lisibles.
 *
 * Les étiquettes ne sont pas cosmétiques : arriver ici depuis un graphique
 * sans savoir *ce qu'on regarde* est déroutant, et il faut un moyen évident
 * de revenir à la bibliothèque entière.
 */
function lireFiltres(p: Params) {
  const filtres: FiltresLivres = {};
  const etiquettes: string[] = [];

  // Posé par les graphiques quand leur portée est « depuis le début » : ils
  // comptent des lectures, la liste doit s'y tenir. Une année le suppose déjà.
  if (p.lu === "1" && !p.annee) {
    filtres.lu = true;
    etiquettes.push("lus");
  }

  const annee = entier(p.annee, 1900, 2200);
  if (annee !== undefined) {
    filtres.annee = annee;
    const mois = entier(p.mois, 1, 12);
    if (mois !== undefined) {
      filtres.mois = mois;
      etiquettes.push(`lus en ${MOIS_LONGS[mois - 1]} ${annee}`);
    } else {
      etiquettes.push(`lus en ${annee}`);
    }
  }

  if (p.genre) {
    filtres.genre = p.genre;
    etiquettes.push(p.genre);
  }

  if (p.format && (FORMATS as readonly string[]).includes(p.format)) {
    filtres.format = p.format as (typeof FORMATS)[number];
    etiquettes.push(LIBELLE_FORMAT[p.format]);
  }

  if (p.note) {
    const n = Number.parseFloat(p.note);
    if (Number.isFinite(n) && n >= 0 && n <= 5) {
      filtres.note = n;
      etiquettes.push(`notés ${n.toLocaleString("fr-FR")} ★`);
    }
  }

  if (p.pages) {
    const tranche = LONGUEURS.find((t) => t.cle === p.pages);
    if (tranche) {
      filtres.pagesMin = tranche.min || undefined;
      if (tranche.max !== Number.MAX_SAFE_INTEGER) filtres.pagesMax = tranche.max;
      etiquettes.push(tranche.libelle);
    }
  }

  if (p.auteur) {
    filtres.auteur = p.auteur;
    etiquettes.push(p.auteur);
  }

  return { filtres, etiquettes };
}

export default async function Bibliotheque({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const statut = (STATUTS as readonly string[]).includes(params.statut ?? "")
    ? (params.statut as Statut)
    : "tous";
  const recherche = params.q?.trim() || undefined;

  const { filtres, etiquettes } = lireFiltres(params);
  const filtre = etiquettes.length > 0;
  const retour = retourSur(params.retour);

  const utilisateurId = await utilisateurCourantId();
  const [livres, { parStatut, total }] = await Promise.all([
    listerLivres(utilisateurId, {
      ...filtres,
      statut,
      recherche,
      tri: filtre ? "titre" : "recent",
    }),
    compterParStatut(utilisateurId),
  ]);

  return (
    <>
      <EnTete
        titre="Bibliothèque"
        detail={
          recherche
            ? `${pluriel(livres.length, "résultat")} pour « ${recherche} »`
            : filtre
              ? pluriel(livres.length, "livre")
              : pluriel(total, "livre")
        }
        action={
          <BoutonLien href="/bibliotheque/ajouter" taille="sm" variante="doux">
            Ajouter
          </BoutonLien>
        }
      />

      {filtre ? (
        // Bandeau de filtre actif : on arrive ici depuis un graphique, il
        // faut voir ce qu'on regarde et pouvoir revenir d'un geste.
        <div className="mx-5 mb-3 flex items-center justify-between gap-3 rounded-tuile bg-rose-poudre px-4 py-2.5">
          <p className="min-w-0 text-[13px] font-medium text-rose-encre">
            {etiquettes.join(" · ")}
          </p>
          {/* Venu d'un graphique, le geste attendu est d'y retourner — pas
              d'élargir le filtre à toute la bibliothèque. */}
          <Link
            href={retour ?? "/bibliotheque"}
            className="flex shrink-0 items-center gap-0.5 text-[12px] font-semibold text-rose-encre underline"
          >
            {retour ? (
              <>
                <IconeRetour className="h-3.5 w-3.5" />
                Statistiques
              </>
            ) : (
              "Tout voir"
            )}
          </Link>
        </div>
      ) : (
        <div className="space-y-3 px-5">
          {/* Masquée quand un filtre de graphique est actif : on regarde
              alors un sous-ensemble précis, pas sa bibliothèque entière. */}
          <RechercheBibliotheque valeur={recherche ?? ""} />
          <FiltresStatut actif={statut} compteurs={parStatut} total={total} />
        </div>
      )}

      {livres.length === 0 ? (
        <EtatVide
          titre={
            recherche
              ? `Rien pour « ${recherche} ».`
              : filtre
                ? "Aucun livre pour ce filtre."
                : total === 0
                  ? "Aucun livre pour l'instant."
                  : `Rien en « ${statut === "tous" ? "tous" : LIBELLE_STATUT[statut]} ».`
          }
          texte={
            recherche
              ? statut !== "tous"
                ? `La recherche ne porte que sur « ${LIBELLE_STATUT[statut]} ». Essaie sur « Tous ».`
                : "Le titre, l'auteur et le nom de série sont fouillés."
              : total === 0
                ? "Importe ta bibliothèque Goodreads, ou ajoute un premier livre à la main."
                : undefined
          }
          action={
            total === 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                <BoutonLien href="/reglages/import" taille="sm">
                  Importer Goodreads
                </BoutonLien>
                <BoutonLien href="/bibliotheque/ajouter" taille="sm" variante="doux">
                  Ajouter un livre
                </BoutonLien>
              </div>
            ) : filtre ? (
              <BoutonLien
                href={retour ?? "/bibliotheque"}
                taille="sm"
                variante="doux"
              >
                {retour ? "Retour aux statistiques" : "Voir toute la bibliothèque"}
              </BoutonLien>
            ) : undefined
          }
        />
      ) : (
        <GrilleLivres livres={livres} />
      )}
    </>
  );
}
