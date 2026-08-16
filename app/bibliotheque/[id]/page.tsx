import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionsLivre } from "@/components/ActionsLivre";
import { Couverture } from "@/components/Couverture";
import { IconeRetour } from "@/components/ui/Icones";
import { livreParId } from "@/db/requetes/livres";
import {
  dateCourte,
  depuis,
  duree,
  libelleTome,
  nombre,
  pourcent,
  progression,
} from "@/lib/format";
import { utilisateurCourantId } from "@/lib/utilisateur";

export const dynamic = "force-dynamic";

export default async function FicheLivre({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const n = Number.parseInt(id, 10);
  if (!Number.isInteger(n)) notFound();

  const utilisateurId = await utilisateurCourantId();
  const donnees = await livreParId(utilisateurId, n);
  if (!donnees) notFound();

  const { livre, historique, journal, extraits } = donnees;
  const avance = progression(livre.pageAtteinte, livre.pages);
  const tome = libelleTome(livre.tome);

  const axes = [
    { cle: "Intensité", valeur: livre.axeIntensite },
    { cle: "Émotion", valeur: livre.axeEmotion },
    { cle: "Noirceur", valeur: livre.axeNoirceur },
    { cle: "Romance", valeur: livre.axeRomance },
  ].filter((a) => a.valeur != null);

  return (
    <div className="pb-10">
      <div
        className="sticky top-0 z-30 bg-velin/85 px-5 pb-2 backdrop-blur-xl"
        style={{ paddingTop: "calc(var(--marge-haut) + 0.75rem)" }}
      >
        <Link
          href="/bibliotheque"
          className="inline-flex min-h-[44px] items-center gap-1 -ml-1.5 text-[15px] text-encre-70"
        >
          <IconeRetour className="h-5 w-5" />
          Bibliothèque
        </Link>
      </div>

      <div className="flex gap-4 px-5 pt-1">
        <Couverture
          titre={livre.titre}
          auteur={livre.auteur}
          url={livre.couvertureUrl}
          genre={livre.genre}
          priorite
          className="h-[168px] w-28 shrink-0"
          sizes="112px"
        />

        <div className="min-w-0 flex-1">
          <h1 className="font-lecture text-[1.375rem] leading-snug font-semibold">
            {livre.titre}
          </h1>
          <p className="mt-1 text-[14px] text-encre-70">{livre.auteur}</p>

          {livre.serieNom ? (
            <p className="mt-1.5 text-[13px] text-encre-45">
              {livre.serieNom}
              {tome ? ` · ${tome}` : ""}
              {livre.serieTomesTotal ? ` sur ${livre.serieTomesTotal}` : ""}
            </p>
          ) : null}

          <p className="chiffres mt-2 text-[13px] text-encre-45">
            {[
              livre.pages ? `${nombre(livre.pages)} pages` : null,
              livre.dureeMinutes ? duree(livre.dureeMinutes) : null,
              livre.genre,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>

          {avance !== null ? (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-pilule bg-bordure">
                <div
                  className="h-full rounded-pilule bg-tranche"
                  style={{ width: `${Math.round(avance * 100)}%` }}
                />
              </div>
              <p className="chiffres mt-1 text-[12px] text-encre-45">
                page {nombre(livre.pageAtteinte)} · {pourcent(avance)}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 px-5">
        <ActionsLivre livre={livre} />
      </div>

      {axes.length ? (
        <section className="mt-8 px-5">
          <h2 className="text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
            Ressenti
          </h2>
          <dl className="mt-3 space-y-2.5">
            {axes.map((a) => (
              <div key={a.cle} className="flex items-center gap-3">
                <dt className="w-20 shrink-0 text-[13px] text-encre-70">
                  {a.cle}
                </dt>
                <dd className="flex flex-1 gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-pilule ${
                        i < (a.valeur ?? 0) ? "bg-dragee" : "bg-bordure"
                      }`}
                    />
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {livre.avis ? (
        <section className="mt-8 px-5">
          <h2 className="text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
            Mon avis
          </h2>
          <p className="mt-2 font-lecture text-[15px] leading-relaxed whitespace-pre-line">
            {livre.avis}
          </p>
        </section>
      ) : null}

      <section className="mt-8 px-5">
        <h2 className="text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
          Journal
        </h2>
        {journal.length === 0 ? (
          <p className="mt-2 text-[14px] text-encre-45">
            Aucune session enregistrée.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-bordure">
            {journal.slice(0, 30).map((s) => (
              <li key={s.id} className="flex items-baseline gap-3 py-2.5">
                <span className="chiffres w-16 shrink-0 text-[13px] text-encre-45">
                  {dateCourte(s.jour)}
                </span>
                <span className="chiffres flex-1 text-[14px]">
                  {s.pageAtteinte != null ? `page ${nombre(s.pageAtteinte)}` : null}
                  {s.pageAtteinte != null && s.minutes != null ? " · " : null}
                  {s.minutes != null ? duree(s.minutes) : null}
                </span>
                {s.noteRapide ? (
                  <span className="max-w-[45%] truncate text-[13px] text-encre-45 italic">
                    {s.noteRapide}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {historique.length > 0 ? (
        <section className="mt-8 px-5">
          <h2 className="text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
            Lectures
          </h2>
          <ul className="mt-3 space-y-1.5">
            {historique.map((l, i) => (
              <li key={l.id} className="chiffres text-[13px] text-encre-70">
                {historique.length > 1
                  ? `${historique.length - i}${historique.length - i === 1 ? "re" : "e"} lecture · `
                  : ""}
                {dateCourte(l.debut)} → {l.fin ? dateCourte(l.fin) : "en cours"}
                {l.abandonnee ? " · abandonnée" : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {extraits.length > 0 ? (
        <section className="mt-8 px-5">
          <h2 className="text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
            Citations
          </h2>
          <ul className="mt-3 space-y-4">
            {extraits.map((c) => (
              <li
                key={c.id}
                className="border-l-2 border-dragee pl-3.5 font-lecture text-[15px] leading-relaxed"
              >
                {c.texte}
                <span className="chiffres mt-1 block text-[12px] not-italic text-encre-45">
                  {c.page ? `page ${c.page} · ` : ""}
                  {depuis(c.creeLe)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
