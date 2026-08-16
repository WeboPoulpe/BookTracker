import Link from "next/link";

import { IconeRetour } from "@/components/ui/Icones";
import { compterParStatut } from "@/db/requetes/livres";
import { pluriel } from "@/lib/format";
import { utilisateurCourantId } from "@/lib/utilisateur";

export const dynamic = "force-dynamic";
export const metadata = { title: "Exporter · Ma Bibliothèque" };

export default async function ExportPage() {
  const utilisateurId = await utilisateurCourantId();
  const { total } = await compterParStatut(utilisateurId);

  return (
    <>
      <div
        className="sticky top-0 z-30 bg-velin/85 px-5 pb-2 backdrop-blur-xl"
        style={{ paddingTop: "calc(var(--marge-haut) + 0.75rem)" }}
      >
        <Link
          href="/reglages"
          className="-ml-1.5 inline-flex min-h-[44px] items-center gap-1 text-[15px] text-encre-70"
        >
          <IconeRetour className="h-5 w-5" />
          Réglages
        </Link>
        <h1 className="mt-1 font-display text-[1.75rem] font-semibold leading-tight">
          Exporter
        </h1>
        <p className="chiffres text-sm text-encre-45">{pluriel(total, "livre")}</p>
      </div>

      <div className="space-y-3 px-5 pt-4 pb-10">
        <a
          href="/api/export?format=csv"
          download
          className="carte block px-4 py-4 active:bg-encre/4"
        >
          <p className="text-[15px] font-medium">CSV Goodreads</p>
          <p className="mt-1 text-[13px] leading-relaxed text-encre-45">
            Réimportable dans Goodreads et dans la plupart des trackers. Ne
            transporte ni les sessions, ni les citations, ni les relectures —
            le format ne les prévoit pas.
          </p>
        </a>

        <a
          href="/api/export?format=json"
          download
          className="carte block px-4 py-4 active:bg-encre/4"
        >
          <p className="text-[15px] font-medium">JSON complet</p>
          <p className="mt-1 text-[13px] leading-relaxed text-encre-45">
            Tout, sans perte : livres, séries, historique de lecture, sessions
            et citations. C&apos;est la sauvegarde à conserver.
          </p>
        </a>

        <p className="px-1 pt-2 text-[13px] leading-relaxed text-encre-45">
          Une base de données personnelle sans sauvegarde est une perte de
          données différée. Exporte le JSON de temps en temps.
        </p>
      </div>
    </>
  );
}
