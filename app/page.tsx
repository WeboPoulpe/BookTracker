import Link from "next/link";

import { Couverture } from "@/components/Couverture";
import { BoutonLien } from "@/components/ui/Bouton";
import { EnTete, EtatVide } from "@/components/ui/EnTete";
import { tableauDeBord } from "@/db/requetes/stats";
import { nombre, pluriel, pourcent, progression } from "@/lib/format";
import { utilisateurCourant } from "@/lib/utilisateur";

export const dynamic = "force-dynamic";

const MOIS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function Tuile({
  valeur,
  libelle,
  accent = false,
}: {
  valeur: string;
  libelle: string;
  accent?: boolean;
}) {
  return (
    <div className="carte px-3.5 py-3">
      <p
        className={`chiffres font-display text-[1.6rem] leading-none font-semibold ${
          accent ? "text-dorure" : ""
        }`}
      >
        {valeur}
      </p>
      <p className="mt-1 text-[12px] leading-tight text-encre-45">{libelle}</p>
    </div>
  );
}

export default async function TableauDeBord() {
  const utilisateur = await utilisateurCourant();
  const s = await tableauDeBord(utilisateur?.id ?? "local");

  const objectif = utilisateur?.objectifAnnuel ?? 30;
  const ratioObjectif = objectif > 0 ? Math.min(1, s.livresAnnee / objectif) : 0;
  const objectifAtteint = s.livresAnnee >= objectif && objectif > 0;
  const maxRythme = Math.max(1, ...s.rythme);

  return (
    <>
      <EnTete titre="Ma Bibliothèque" detail={`Année ${s.annee}`} />

      <div className="space-y-6 px-5 pb-10">
        {/* ── En cours ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-2 text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
            En cours
          </h2>

          {s.enCours.length === 0 ? (
            <EtatVide
              titre="Aucun livre en cours."
              texte={
                s.total > 0
                  ? "Ouvre ta bibliothèque et reprends là où tu en étais."
                  : "Importe ta bibliothèque Goodreads, ou ajoute un premier livre."
              }
              action={
                <BoutonLien
                  href={s.total > 0 ? "/bibliotheque" : "/reglages/import"}
                  taille="sm"
                >
                  {s.total > 0 ? "Voir ma bibliothèque" : "Importer Goodreads"}
                </BoutonLien>
              }
            />
          ) : (
            <ul className="space-y-2.5">
              {s.enCours.map((l) => {
                const avance = progression(l.pageAtteinte, l.pages);
                return (
                  <li key={l.id}>
                    <Link
                      href={`/bibliotheque/${l.id}`}
                      className="carte flex items-center gap-3.5 p-3 transition-transform active:scale-[0.98]"
                    >
                      <Couverture
                        titre={l.titre}
                        auteur={l.auteur}
                        url={l.couvertureUrl}
                        genre={l.genre}
                        className="h-[76px] w-[52px] shrink-0"
                        sizes="52px"
                        priorite
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-lecture text-[15px] leading-snug font-medium line-clamp-2">
                          {l.titre}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-encre-45">
                          {l.auteur}
                        </p>

                        {avance !== null ? (
                          <>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-pilule bg-bordure">
                              <div
                                className="h-full rounded-pilule bg-tranche"
                                style={{ width: `${Math.round(avance * 100)}%` }}
                              />
                            </div>
                            <p className="chiffres mt-1 text-[11px] text-encre-45">
                              page {nombre(l.pageAtteinte)} sur{" "}
                              {nombre(l.pages)} · {pourcent(avance)}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1.5 text-[11px] text-encre-45">
                            Aucune session enregistrée.
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Objectif ─────────────────────────────────────────────────── */}
        <section>
          <div className="carte p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
                Objectif {s.annee}
              </h2>
              <p className="chiffres text-[13px] text-encre-45">
                {nombre(s.livresAnnee)} / {nombre(objectif)}
              </p>
            </div>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-pilule bg-bordure">
              <div
                className="h-full rounded-pilule transition-[width] duration-500"
                style={{
                  width: `${Math.round(ratioObjectif * 100)}%`,
                  // La dorure est réservée à un seul usage par écran (§7) :
                  // ici, l'objectif atteint. Sinon elle perd tout effet.
                  backgroundColor: objectifAtteint ? "#E8B84B" : "#BBD4C4",
                }}
              />
            </div>
            {objectifAtteint ? (
              <p className="mt-2 text-[13px] font-medium text-dorure">
                Objectif atteint.
              </p>
            ) : null}
          </div>
        </section>

        {/* ── Chiffres ─────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-2.5">
          <Tuile valeur={nombre(s.livresAnnee)} libelle={`Livres en ${s.annee}`} />
          <Tuile valeur={nombre(s.pagesAnnee)} libelle="Pages lues" />
          <Tuile
            valeur={s.serie > 0 ? pluriel(s.serie, "jour") : "—"}
            libelle="Jours d'affilée"
            accent={!objectifAtteint && s.serie >= 7}
          />
          <Tuile
            valeur={s.tauxAbandon === null ? "—" : pourcent(s.tauxAbandon)}
            libelle="Taux d'abandon"
          />
        </section>

        {/* ── Rythme ───────────────────────────────────────────────────── */}
        {s.livresAnnee > 0 ? (
          <section className="carte p-4">
            <h2 className="text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
              Rythme mensuel
            </h2>
            <div className="mt-3 flex h-24 items-end gap-1.5">
              {s.rythme.map((n, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-[3px] bg-tranche"
                      style={{
                        height: `${Math.max(n > 0 ? 8 : 2, (n / maxRythme) * 100)}%`,
                        opacity: n > 0 ? 1 : 0.25,
                      }}
                      title={`${MOIS[i]} : ${pluriel(n, "livre")}`}
                    />
                  </div>
                  <span className="text-[9px] text-encre-45">{MOIS[i]}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Palmarès ─────────────────────────────────────────────────── */}
        {s.topAuteurs.length > 0 || s.genreDominant ? (
          <section className="carte p-4">
            <h2 className="text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
              Cette année
            </h2>

            {s.genreDominant ? (
              <p className="mt-2 text-[14px]">
                Genre dominant :{" "}
                <span className="font-medium">{s.genreDominant.valeur}</span>
                <span className="chiffres text-encre-45">
                  {" "}
                  · {pluriel(s.genreDominant.total, "livre")}
                </span>
              </p>
            ) : null}

            {s.topAuteurs.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {s.topAuteurs.map((a) => (
                  <li
                    key={a.valeur}
                    className="flex items-baseline justify-between gap-3 text-[14px]"
                  >
                    <span className="truncate">{a.valeur}</span>
                    <span className="chiffres shrink-0 text-encre-45">
                      {nombre(a.total)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
