import Link from "next/link";

import { Tranche } from "@/components/Tranche";
import { BoutonLien } from "@/components/ui/Bouton";
import { EnTete, EtatVide } from "@/components/ui/EnTete";
import { listerLivres, type LivreListe } from "@/db/requetes/livres";
import { nombre } from "@/lib/format";
import { libelleClassement, resoudreGenre } from "@/lib/genres";
import { utilisateurCourantId } from "@/lib/utilisateur";

export const dynamic = "force-dynamic";
export const metadata = { title: "Étagère · Ma Bibliothèque" };

type Groupement = "annee" | "genre" | "sousGenre" | "auteur" | "serie";

const GROUPEMENTS: Array<{ cle: Groupement; libelle: string }> = [
  { cle: "annee", libelle: "Par année" },
  { cle: "genre", libelle: "Par genre" },
  { cle: "sousGenre", libelle: "Par sous-genre" },
  { cle: "auteur", libelle: "Par auteur" },
  { cle: "serie", libelle: "Par série" },
];

/**
 * Rayons des livres sans année de lecture, nommés d'après leur statut.
 *
 * Tout livre sans date de fin atterrissait dans « En cours de lecture », ce
 * qui était faux pour la plupart : une pile à lire jamais ouverte n'est pas
 * une lecture en cours. Le statut, lui, sait déjà les distinguer — il suffit
 * de le lire.
 *
 * L'ordre est celui de la liste : le rayon actif d'abord, la pile ensuite,
 * les cas éteints en dernier.
 */
const RAYONS_SANS_ANNEE: Array<{ statut: string; libelle: string }> = [
  { statut: "en_cours", libelle: "En cours de lecture" },
  { statut: "en_pause", libelle: "En pause" },
  { statut: "a_lire", libelle: "À lire" },
  { statut: "abandonne", libelle: "Abandonné" },
  // Un livre marqué lu dont aucune lecture ne porte de date. Le nommer ainsi
  // vaut mieux que de l'inventer une année.
  { statut: "lu", libelle: "Lu, date inconnue" },
];

/** Rayons qui n'en sont pas : ils passent en fin d'étagère. */
const FOURRE_TOUT = [
  "Hors série",
  "Sans genre",
  "Auteur inconnu",
  ...RAYONS_SANS_ANNEE.map((r) => r.libelle),
];

function grouper(livres: LivreListe[], par: Groupement) {
  const groupes = new Map<string, LivreListe[]>();

  for (const l of livres) {
    let cle: string;
    if (par === "serie") {
      cle = l.serieNom ?? "Hors série";
    } else if (par === "auteur") {
      cle = l.auteur?.trim() || "Auteur inconnu";
    } else if (par === "genre") {
      cle = resoudreGenre(l.genre).libelle;
    } else if (par === "sousGenre") {
      // Sans sous-genre, le livre compte pour son genre : le ranger dans un
      // « Sans sous-genre » fourre-tout n'apprendrait rien, et ce serait le
      // rayon le plus fourni de l'étagère.
      cle = libelleClassement(l.genre, l.sousGenre);
    } else {
      // Année de *lecture*, pas d'ajout : un roman acheté en 2024 et lu en
      // 2026 appartient à l'étagère 2026. Sans date de fin, le livre n'a pas
      // encore d'année — son statut dit alors où il en est.
      cle = l.derniereFin
        ? String(new Date(`${l.derniereFin}T12:00:00`).getFullYear())
        : (RAYONS_SANS_ANNEE.find((r) => r.statut === l.statut)?.libelle ??
          "À lire");
    }

    const existant = groupes.get(cle);
    if (existant) existant.push(l);
    else groupes.set(cle, [l]);
  }

  return [...groupes.entries()]
    .map(([cle, l]) => [cle, ordonner(l)] as const)
    .sort(([a], [b]) => {
      const fa = FOURRE_TOUT.includes(a);
      const fb = FOURRE_TOUT.includes(b);
      if (fa !== fb) return fa ? 1 : -1;

      // Entre rayons sans année, l'ordre déclaré prime sur l'alphabet :
      // « Abandonné » n'a pas à ouvrir la marche devant « En cours ».
      const ia = RAYONS_SANS_ANNEE.findIndex((r) => r.libelle === a);
      const ib = RAYONS_SANS_ANNEE.findIndex((r) => r.libelle === b);
      if (ia !== -1 && ib !== -1) return ia - ib;

      // Les années à l'envers : l'année en cours en premier.
      if (par === "annee") return b.localeCompare(a);
      return a.localeCompare(b, "fr");
    });
}

/**
 * Ordre des tranches à l'intérieur d'un rayon : la chronologie de lecture.
 *
 * Un rayon rangé par titre ne raconte rien. Rangé par date de fin, il se lit
 * de gauche à droite comme l'année s'est déroulée : le rayon 2026 s'ouvre sur
 * le premier livre terminé cette année-là. C'est ce que l'étagère physique
 * qu'on imite ne sait pas faire, et c'est vrai de tous les regroupements —
 * un rayon d'auteur montre alors l'ordre dans lequel on l'a découvert.
 *
 * Les livres non terminés ferment le rayon : ils n'ont pas encore de place
 * dans cette chronologie, et les mettre en tête daterait le rayon de rien.
 * Entre eux, le titre départage, faute de mieux.
 */
function ordonner(livres: LivreListe[]): LivreListe[] {
  return [...livres].sort((a, b) => {
    // Les dates sont en `YYYY-MM-DD` : l'ordre lexicographique est l'ordre
    // chronologique, sans passer par des objets Date.
    if (a.derniereFin && b.derniereFin) {
      return a.derniereFin.localeCompare(b.derniereFin);
    }
    if (a.derniereFin) return -1;
    if (b.derniereFin) return 1;
    return a.titre.localeCompare(b.titre, "fr");
  });
}

export default async function Etagere({
  searchParams,
}: {
  searchParams: Promise<{ par?: string }>;
}) {
  const params = await searchParams;
  // Par défaut, le premier de la liste : l'année de lecture est la lentille
  // la plus parlante pour retrouver un livre — on se souvient mieux de
  // « l'hiver dernier » que du genre qu'on lui avait attribué.
  const par: Groupement = GROUPEMENTS.some((g) => g.cle === params.par)
    ? (params.par as Groupement)
    : GROUPEMENTS[0].cle;

  // L'écran exact d'où l'on part, regroupement compris : revenir de la fiche
  // doit rendre l'étagère telle qu'on l'a quittée, pas son onglet par défaut.
  const retour = `/etagere?par=${par}`;

  const utilisateurId = await utilisateurCourantId();
  const livres = await listerLivres(utilisateurId, { tri: "titre" });

  const pagesTotales = livres.reduce((s, l) => s + (l.pages ?? 0), 0);
  const groupes = grouper(livres, par);

  // Le décalage de cascade court à travers toute la page, pas par rayon :
  // trois rayons qui démarrent ensemble donnent trois animations, pas une.
  let rang = 0;

  return (
    <>
      <EnTete
        titre="Étagère"
        detail={
          livres.length
            ? `${nombre(livres.length)} livres · ${nombre(pagesTotales)} pages`
            : undefined
        }
      />

      <div className="rail-horizontal px-5 pb-2">
        <div className="flex w-max gap-2">
          {GROUPEMENTS.map((g) => {
            const actif = g.cle === par;
            return (
              <Link
                key={g.cle}
                href={`/etagere?par=${g.cle}`}
                scroll={false}
                className={`flex min-h-[38px] items-center rounded-pilule px-4 text-[13px] font-semibold whitespace-nowrap ${
                  actif
                    ? "degrade-dragee text-rose-encre shadow-dragee"
                    : "bg-white/70 text-encre-70 ring-1 ring-white/80 backdrop-blur-sm"
                }`}
              >
                {g.libelle}
              </Link>
            );
          })}
        </div>
      </div>

      {livres.length === 0 ? (
        <EtatVide
          titre="L'étagère est vide."
          texte="Chaque tranche encode le nombre de pages par sa largeur, le genre par sa couleur, et la progression par son remplissage."
          action={
            <BoutonLien href="/bibliotheque/ajouter" taille="sm">
              Ajouter un livre
            </BoutonLien>
          }
        />
      ) : (
        <div className="space-y-7 pt-3 pb-10">
          {groupes.map(([nom, livresDuGroupe]) => (
            <section key={nom}>
              <h2 className="px-5 text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
                {nom}
                <span className="chiffres ml-2 font-normal normal-case opacity-70">
                  {nombre(livresDuGroupe.length)}
                </span>
              </h2>

              <div className="rail-horizontal mt-2.5 px-5">
                {/* Le filet sous les tranches, c'est la planche de l'étagère */}
                {/* Le filet sous les tranches, c'est la planche de l'étagère —
                    dégradé pour lui donner une épaisseur, pas juste un trait */}
                <div className="flex w-max items-end gap-[3px] border-b-[3px] border-[#D8C3B0] pb-0">
                  {livresDuGroupe.map((livre) => (
                    <Tranche
                      key={livre.id}
                      livre={livre}
                      rang={rang++}
                      retour={retour}
                    />
                  ))}
                </div>
              </div>
            </section>
          ))}

          <p className="px-5 text-[12px] leading-relaxed text-encre-45">
            Largeur = pages · couleur = genre · remplissage = progression ·
            liseré doré = 5 étoiles.
          </p>
        </div>
      )}
    </>
  );
}
