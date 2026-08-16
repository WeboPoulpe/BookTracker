import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { SegmentsBibliotheque } from "@/components/SegmentsBibliotheque";
import { BoutonLien } from "@/components/ui/Bouton";
import { EnTete, EtatVide } from "@/components/ui/EnTete";
import { db } from "@/db";
import { citations, livres } from "@/db/schema";
import { depuis, pluriel } from "@/lib/format";
import { utilisateurCourantId } from "@/lib/utilisateur";

export const dynamic = "force-dynamic";
export const metadata = { title: "Citations · Ma Bibliothèque" };

export default async function CitationsPage() {
  const utilisateurId = await utilisateurCourantId();

  const lignes = await db
    .select({
      id: citations.id,
      texte: citations.texte,
      page: citations.page,
      creeLe: citations.creeLe,
      livreId: livres.id,
      titre: livres.titre,
      auteur: livres.auteur,
    })
    .from(citations)
    .innerJoin(livres, eq(livres.id, citations.livreId))
    .where(eq(livres.utilisateurId, utilisateurId))
    .orderBy(desc(citations.creeLe));

  return (
    <>
      <EnTete titre="Citations" detail={pluriel(lignes.length, "citation")} />

      <SegmentsBibliotheque actif="/citations" />

      {lignes.length === 0 ? (
        <EtatVide
          titre="Aucune citation."
          texte="C'est ce qu'on relit avec le plus de plaisir un an après. Les citations s'ajoutent depuis la fiche d'un livre."
          action={
            <BoutonLien href="/bibliotheque" taille="sm" variante="doux">
              Ouvrir la bibliothèque
            </BoutonLien>
          }
        />
      ) : (
        <ul className="space-y-4 px-5 pt-4 pb-10">
          {lignes.map((c) => (
            <li key={c.id} className="carte p-4">
              <blockquote className="border-l-2 border-dragee pl-3.5 font-lecture text-[16px] leading-relaxed">
                {c.texte}
              </blockquote>
              <Link
                href={`/bibliotheque/${c.livreId}`}
                className="mt-2.5 block text-[12px] text-encre-45"
              >
                {c.titre} · {c.auteur}
                {c.page ? ` · page ${c.page}` : ""}
                <span className="opacity-70"> · {depuis(c.creeLe)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
