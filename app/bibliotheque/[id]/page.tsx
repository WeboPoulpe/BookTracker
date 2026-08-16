import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionsLivre } from "@/components/ActionsLivre";
import { Couverture } from "@/components/Couverture";
import { Section } from "@/components/ui/EnTete";
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
import { resoudreGenre } from "@/lib/genres";
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
  const genre = resoudreGenre(livre.genre);

  const axes = [
    { cle: "Intensité", valeur: livre.axeIntensite },
    { cle: "Émotion", valeur: livre.axeEmotion },
    { cle: "Noirceur", valeur: livre.axeNoirceur },
    { cle: "Romance", valeur: livre.axeRomance },
  ].filter((a) => a.valeur != null);

  return (
    <div className="pb-8">
      <div
        className="sticky top-0 z-30 px-5 pb-2"
        style={{
          paddingTop: "calc(var(--marge-haut) + 0.75rem)",
          background:
            "linear-gradient(180deg, var(--color-velin) 60%, transparent 100%)",
        }}
      >
        <Link
          href="/bibliotheque"
          className="-ml-1.5 inline-flex min-h-[44px] items-center gap-1 text-[15px] font-medium text-encre-70"
        >
          <IconeRetour className="h-5 w-5" />
          Bibliothèque
        </Link>
      </div>

      {/* Bandeau teinté par le genre : la fiche prend la couleur du livre */}
      <div className="relative px-5 pt-1">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-40 -z-10 opacity-45 blur-2xl"
          style={{
            background: `radial-gradient(ellipse at 30% 0%, ${genre.couleur} 0%, transparent 70%)`,
          }}
        />

        <div className="flex gap-4">
          <Couverture
            titre={livre.titre}
            auteur={livre.auteur}
            url={livre.couvertureUrl}
            genre={livre.genre}
            priorite
            className="h-[178px] w-[120px] shrink-0 shadow-carte-forte"
            sizes="120px"
          />

          <div className="min-w-0 flex-1">
            <h1 className="font-lecture text-[1.45rem] leading-[1.2] font-semibold">
              {livre.titre}
            </h1>
            <p className="mt-1.5 text-[14px] text-encre-70">{livre.auteur}</p>

            {livre.serieNom ? (
              <p className="mt-2 inline-block rounded-pilule bg-white/80 px-2.5 py-1 text-[12px] font-medium text-rose-encre ring-1 ring-rose-poudre">
                {livre.serieNom}
                {tome ? ` · ${tome}` : ""}
                {livre.serieTomesTotal ? ` / ${livre.serieTomesTotal}` : ""}
              </p>
            ) : null}

            <p className="chiffres mt-2.5 text-[12.5px] text-encre-45">
              {[
                livre.pages ? `${nombre(livre.pages)} pages` : null,
                livre.dureeMinutes ? duree(livre.dureeMinutes) : null,
                livre.genre,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>

            {livre.note != null ? (
              <p className="mt-2 text-[15px] text-dorure">
                {"★".repeat(Math.floor(livre.note))}
                {livre.note % 1 ? "☆" : ""}
                <span className="chiffres ml-1.5 text-[12.5px] text-encre-45">
                  {livre.note.toLocaleString("fr-FR")}/5
                </span>
              </p>
            ) : null}
          </div>
        </div>

        {avance !== null ? (
          <div className="mt-4 rounded-carte bg-white/85 p-3.5 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
            <div className="h-2.5 overflow-hidden rounded-pilule bg-rose-poudre">
              <div
                className="degrade-dragee h-full rounded-pilule"
                style={{ width: `${Math.round(avance * 100)}%` }}
              />
            </div>
            <p className="chiffres mt-2 text-[12.5px] font-medium text-rose-fonce">
              page {nombre(livre.pageAtteinte)} sur {nombre(livre.pages)} ·{" "}
              {pourcent(avance)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 px-5">
        <ActionsLivre livre={livre} />
      </div>

      <div className="mt-8 space-y-7 px-5">
        {axes.length ? (
          <Section titre="Ressenti">
            <dl className="space-y-3 rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
              {axes.map((a) => (
                <div key={a.cle} className="flex items-center gap-3">
                  <dt className="w-20 shrink-0 text-[13px] text-encre-70">
                    {a.cle}
                  </dt>
                  <dd className="flex flex-1 gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <span
                        key={i}
                        className={`h-2 flex-1 rounded-pilule ${
                          i < (a.valeur ?? 0) ? "bg-dragee" : "bg-rose-poudre"
                        }`}
                      />
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>
        ) : null}

        {livre.avis ? (
          <Section titre="Mon avis">
            <p className="rounded-carte bg-white/85 p-4 font-lecture text-[15.5px] leading-relaxed whitespace-pre-line shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
              {livre.avis}
            </p>
          </Section>
        ) : null}

        <Section titre="Journal">
          {journal.length === 0 ? (
            <p className="text-[14px] text-encre-45">
              Aucune session enregistrée.
            </p>
          ) : (
            <ul className="divide-y divide-bordure rounded-carte bg-white/85 px-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
              {journal.slice(0, 30).map((s) => (
                <li key={s.id} className="flex items-baseline gap-3 py-3">
                  <span className="chiffres w-14 shrink-0 text-[12.5px] text-encre-45">
                    {dateCourte(s.jour)}
                  </span>
                  <span className="chiffres flex-1 text-[14px] font-medium">
                    {s.pageAtteinte != null
                      ? `page ${nombre(s.pageAtteinte)}`
                      : null}
                    {s.pageAtteinte != null && s.minutes != null ? " · " : null}
                    {s.minutes != null ? duree(s.minutes) : null}
                  </span>
                  {s.noteRapide ? (
                    <span className="max-w-[45%] truncate text-[12.5px] text-encre-45 italic">
                      {s.noteRapide}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {historique.length > 0 ? (
          <Section titre="Lectures">
            <ul className="space-y-1.5">
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
          </Section>
        ) : null}

        {extraits.length > 0 ? (
          <Section titre="Citations">
            <ul className="space-y-3">
              {extraits.map((c) => (
                <li
                  key={c.id}
                  className="rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm"
                >
                  <blockquote className="border-l-2 border-dragee pl-3.5 font-lecture text-[15.5px] leading-relaxed">
                    {c.texte}
                  </blockquote>
                  <p className="chiffres mt-2 text-[12px] text-encre-45">
                    {c.page ? `page ${c.page} · ` : ""}
                    {depuis(c.creeLe)}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
