import Link from "next/link";

import { ObjectifAnnuel } from "@/components/ObjectifAnnuel";
import { EnTete } from "@/components/ui/EnTete";
import { compterParStatut } from "@/db/requetes/livres";
import { pluriel } from "@/lib/format";
import { MODE_LOCAL, utilisateurCourant } from "@/lib/utilisateur";

export const dynamic = "force-dynamic";

function Rangee({
  href,
  titre,
  detail,
}: {
  href: string;
  titre: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-3 transition-colors active:bg-rose-voile"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">{titre}</span>
        <span className="block text-[12.5px] text-encre-45">{detail}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-[18px] text-rose-fonce">
        ›
      </span>
    </Link>
  );
}

export default async function Reglages() {
  const utilisateur = await utilisateurCourant();
  const { total } = await compterParStatut(utilisateur?.id ?? "local");

  return (
    <>
      <EnTete titre="Réglages" detail={utilisateur?.email ?? undefined} />

      <div className="space-y-5 px-5 pt-2 pb-10">
        <section>
          <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
            Mes données
          </h2>
          <div className="carte divide-y divide-bordure overflow-hidden">
            <Rangee
              href="/reglages/import"
              titre="Importer depuis Goodreads"
              detail="CSV, avec aperçu avant confirmation"
            />
            <Rangee
              href="/reglages/kindle"
              titre="Surlignages Kindle"
              detail="Le fichier My Clippings.txt de la liseuse"
            />
            <Rangee
              href="/reglages/export"
              titre="Exporter"
              detail={`CSV Goodreads ou JSON complet · ${pluriel(total, "livre")}`}
            />
          </div>

          {/* Notice courte : les deux imports inquiètent pour la même raison
              — la peur d'écraser ou de dupliquer. Deux phrases suffisent à
              lever le doute, un pavé ne serait pas lu. */}
          <p className="mt-2 px-1 text-[12.5px] leading-relaxed text-encre-45">
            <span className="font-semibold text-encre-70">
              Goodreads apporte tes livres, Kindle tes surlignages.
            </span>{" "}
            Tu vois toujours ce qui sera ajouté avant de confirmer, et
            réimporter le même fichier ne crée jamais de doublon.
          </p>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
            Lecture
          </h2>
          <div className="carte overflow-hidden">
            <ObjectifAnnuel valeur={utilisateur?.objectifAnnuel ?? 30} />
          </div>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
            Compte
          </h2>
          <div className="carte px-4 py-3">
            <p className="text-[15px]">
              {MODE_LOCAL ? "Mode mono-utilisateur" : "Connecté"}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-encre-45">
              {MODE_LOCAL
                ? "L'app tourne sur un compte local, sans connexion. Renseigne AUTH_GOOGLE_ID et AUTH_GOOGLE_SECRET pour activer la connexion Google."
                : (utilisateur?.email ?? "—")}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
