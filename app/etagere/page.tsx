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

type Groupement = "serie" | "genre" | "sousGenre" | "annee";

const GROUPEMENTS: Array<{ cle: Groupement; libelle: string }> = [
  { cle: "serie", libelle: "Par série" },
  { cle: "genre", libelle: "Par genre" },
  { cle: "sousGenre", libelle: "Par sous-genre" },
  { cle: "annee", libelle: "Par année" },
];

function grouper(livres: LivreListe[], par: Groupement) {
  const groupes = new Map<string, LivreListe[]>();

  for (const l of livres) {
    let cle: string;
    if (par === "serie") {
      cle = l.serieNom ?? "Hors série";
    } else if (par === "genre") {
      cle = resoudreGenre(l.genre).libelle;
    } else if (par === "sousGenre") {
      // Sans sous-genre, le livre compte pour son genre : le ranger dans un
      // « Sans sous-genre » fourre-tout n'apprendrait rien, et ce serait le
      // rayon le plus fourni de l'étagère.
      cle = libelleClassement(l.genre, l.sousGenre);
    } else {
      cle = l.creeLe ? String(new Date(l.creeLe).getFullYear()) : "Sans date";
    }

    const existant = groupes.get(cle);
    if (existant) existant.push(l);
    else groupes.set(cle, [l]);
  }

  return [...groupes.entries()].sort(([a], [b]) => {
    // « Hors série » et « Sans genre » en dernier : ce sont des fourre-tout,
    // pas des rayons.
    const fourreTout = ["Hors série", "Sans genre", "Sans date"];
    const fa = fourreTout.includes(a);
    const fb = fourreTout.includes(b);
    if (fa !== fb) return fa ? 1 : -1;
    if (par === "annee") return b.localeCompare(a);
    return a.localeCompare(b, "fr");
  });
}

export default async function Etagere({
  searchParams,
}: {
  searchParams: Promise<{ par?: string }>;
}) {
  const params = await searchParams;
  const par: Groupement = GROUPEMENTS.some((g) => g.cle === params.par)
    ? (params.par as Groupement)
    : "serie";

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
                    <Tranche key={livre.id} livre={livre} rang={rang++} />
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
