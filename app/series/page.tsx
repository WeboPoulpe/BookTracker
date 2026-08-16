import Link from "next/link";

import { Couverture } from "@/components/Couverture";
import { SegmentsBibliotheque } from "@/components/SegmentsBibliotheque";
import { BoutonLien } from "@/components/ui/Bouton";
import { EnTete, EtatVide } from "@/components/ui/EnTete";
import { listerSeries } from "@/db/requetes/series";
import { libelleTome, pluriel } from "@/lib/format";
import { utilisateurCourantId } from "@/lib/utilisateur";

export const dynamic = "force-dynamic";
export const metadata = { title: "Séries · Ma Bibliothèque" };

export default async function SeriesPage() {
  const utilisateurId = await utilisateurCourantId();
  const series = await listerSeries(utilisateurId);

  return (
    <>
      <EnTete titre="Séries" detail={pluriel(series.length, "série")} />

      <SegmentsBibliotheque actif="/series" />

      {series.length === 0 ? (
        <EtatVide
          titre="Aucune série."
          texte="Renseigne le champ « Série » d'un livre, ou importe ta bibliothèque Goodreads — les séries y sont notées entre parenthèses dans le titre."
          action={
            <BoutonLien href="/reglages/import" taille="sm">
              Importer Goodreads
            </BoutonLien>
          }
        />
      ) : (
        <ul className="space-y-3 px-5 pt-4 pb-8">
          {series.map((s) => {
            const total = s.tomesTotal;
            const ratio = total ? Math.min(1, s.tomesLus / total) : 0;

            return (
              <li key={s.id} className="carte overflow-hidden">
                <div className="flex gap-3.5 p-3.5">
                  <Couverture
                    titre={s.prochain?.titre ?? s.nom}
                    url={s.prochain?.couvertureUrl ?? null}
                    genre={s.prochain?.genre ?? s.genre}
                    className="h-[92px] w-[62px] shrink-0"
                    sizes="62px"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="font-lecture text-[16px] leading-snug font-semibold">
                      {s.nom}
                    </p>
                    {s.auteur ? (
                      <p className="mt-0.5 truncate text-[12px] text-encre-45">
                        {s.auteur}
                      </p>
                    ) : null}

                    <p className="chiffres mt-1.5 text-[13px] text-encre-70">
                      {total
                        ? `Tome ${s.tomesLus} sur ${total}`
                        : pluriel(s.tomesLus, "tome lu", "tomes lus")}
                      {s.enPause ? " · en pause" : s.enCours ? " · en cours" : ""}
                    </p>

                    {total ? (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-pilule bg-bordure">
                        <div
                          className="h-full rounded-pilule bg-sauge"
                          style={{ width: `${Math.round(ratio * 100)}%` }}
                        />
                      </div>
                    ) : null}

                    {s.prochain ? (
                      <Link
                        href={`/bibliotheque/${s.prochain.id}`}
                        className="mt-2 inline-flex min-h-[32px] items-center rounded-pilule bg-dragee px-3 text-[12px] font-medium text-[#5C2740]"
                      >
                        {s.prochain.statut === "en_cours"
                          ? "Reprendre"
                          : "Prochain"}
                        {s.prochain.tome != null
                          ? ` · ${libelleTome(s.prochain.tome)?.toLowerCase()}`
                          : ""}
                      </Link>
                    ) : (
                      <p className="mt-2 text-[12px] text-[#1F4033]">
                        Série terminée.
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
