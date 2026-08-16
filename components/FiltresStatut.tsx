import Link from "next/link";

import type { Statut } from "@/db/schema";
import { LIBELLE_STATUT, ORDRE_STATUTS, nombre } from "@/lib/format";

/**
 * Rail de filtres. Défilement horizontal plutôt qu'un menu déroulant : sur
 * mobile, un rail se balaie au pouce là où un `select` ouvre une roulette
 * système qui casse le fil de la navigation.
 */
export function FiltresStatut({
  actif,
  compteurs,
  total,
}: {
  actif: Statut | "tous";
  compteurs: Record<Statut, number>;
  total: number;
}) {
  const entrees: Array<{ cle: Statut | "tous"; libelle: string; n: number }> = [
    { cle: "tous", libelle: "Tous", n: total },
    ...ORDRE_STATUTS.map((s) => ({
      cle: s,
      libelle: LIBELLE_STATUT[s],
      n: compteurs[s] ?? 0,
    })),
  ];

  return (
    <div className="rail-horizontal -mx-5 px-5">
      <div className="flex w-max gap-2 pb-1">
        {entrees.map(({ cle, libelle, n }) => {
          const estActif = cle === actif;
          return (
            <Link
              key={cle}
              href={cle === "tous" ? "/bibliotheque" : `/bibliotheque?statut=${cle}`}
              scroll={false}
              aria-current={estActif ? "true" : undefined}
              className={`flex min-h-[36px] items-center gap-1.5 rounded-pilule px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                estActif
                  ? "bg-encre text-velin"
                  : "bg-papier text-encre-70 active:bg-encre/5"
              }`}
            >
              {libelle}
              <span
                className={`chiffres text-[11px] ${estActif ? "opacity-60" : "opacity-45"}`}
              >
                {nombre(n)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
