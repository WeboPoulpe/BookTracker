"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { Couverture } from "@/components/Couverture";
import { BoutonLien } from "@/components/ui/Bouton";
import { Compteur } from "@/components/ui/Compteur";
import { EtatVide, Section } from "@/components/ui/EnTete";
import type { tableauDeBord } from "@/db/requetes/stats";
import {
  RESSORT,
  RESSORT_REBOND,
  TOUCHER_DOUX,
  conteneurCascade,
  elementCascade,
} from "@/lib/anim";
import { nombre, pluriel, pourcent, progression } from "@/lib/format";

type Stats = Awaited<ReturnType<typeof tableauDeBord>>;

const MOIS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const LienAnime = motion.create(Link);

function Tuile({
  valeur,
  suffixe,
  libelle,
  accent = false,
}: {
  valeur: number;
  suffixe?: string;
  libelle: string;
  accent?: boolean;
}) {
  return (
    <motion.div
      variants={elementCascade}
      className={`rounded-tuile px-4 py-3.5 ${
        accent
          ? "bg-gradient-to-br from-[#F6DFA8] to-[#E8C46A] shadow-[0_4px_16px_rgb(224_168_60/0.35)]"
          : "bg-white/85 shadow-carte ring-1 ring-white/70 backdrop-blur-sm"
      }`}
    >
      <p
        className={`chiffres font-display text-[1.75rem] leading-none font-bold ${
          accent ? "text-[#4A3410]" : "text-encre"
        }`}
      >
        <Compteur valeur={valeur} />
        {suffixe ? <span className="text-[1.1rem]">{suffixe}</span> : null}
      </p>
      <p
        className={`mt-1.5 text-[11.5px] leading-tight font-medium ${
          accent ? "text-[#6B4E16]" : "text-encre-45"
        }`}
      >
        {libelle}
      </p>
    </motion.div>
  );
}

export function TableauDeBord({
  stats: s,
  objectif,
}: {
  stats: Stats;
  objectif: number;
}) {
  const ratioObjectif = objectif > 0 ? Math.min(1, s.livresAnnee / objectif) : 0;
  const objectifAtteint = s.livresAnnee >= objectif && objectif > 0;
  const maxRythme = Math.max(1, ...s.rythme);
  const moisCourant = new Date().getMonth();

  return (
    <motion.div
      initial="masque"
      animate="visible"
      variants={conteneurCascade(0.07)}
      className="space-y-7 px-5 pb-8"
    >
      {/* ── En cours ───────────────────────────────────────────────────── */}
      <motion.div variants={elementCascade}>
        <Section titre="En cours de lecture">
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
            <div className="space-y-2.5">
              {s.enCours.map((l, i) => {
                const avance = progression(l.pageAtteinte, l.pages);
                return (
                  <LienAnime
                    key={l.id}
                    href={`/bibliotheque/${l.id}`}
                    whileTap={TOUCHER_DOUX}
                    transition={RESSORT}
                    className="flex items-center gap-4 rounded-carte bg-white/85 p-3 shadow-carte ring-1 ring-white/70 backdrop-blur-sm"
                  >
                    <Couverture
                      titre={l.titre}
                      auteur={l.auteur}
                      url={l.couvertureUrl}
                      genre={l.genre}
                      className="h-[82px] w-[56px] shrink-0"
                      sizes="56px"
                      priorite
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-lecture text-[15.5px] leading-snug font-semibold line-clamp-2">
                        {l.titre}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-encre-45">
                        {l.auteur}
                      </p>

                      {avance !== null ? (
                        <>
                          <div className="mt-2.5 h-2 overflow-hidden rounded-pilule bg-rose-poudre">
                            <motion.div
                              className="degrade-dragee h-full rounded-pilule"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.round(avance * 100)}%` }}
                              transition={{ ...RESSORT, delay: 0.25 + i * 0.08 }}
                            />
                          </div>
                          <p className="chiffres mt-1 text-[11px] font-medium text-rose-fonce">
                            page {nombre(l.pageAtteinte)} sur {nombre(l.pages)} ·{" "}
                            {pourcent(avance)}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-encre-45">
                          Aucune session enregistrée.
                        </p>
                      )}
                    </div>
                  </LienAnime>
                );
              })}
            </div>
          )}
        </Section>
      </motion.div>

      {/* ── Objectif ───────────────────────────────────────────────────── */}
      <motion.div variants={elementCascade}>
        <Section titre={`Objectif ${s.annee}`}>
          <div className="rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
            <div className="flex items-baseline justify-between">
              <p className="chiffres font-display text-[1.5rem] leading-none font-bold">
                <Compteur valeur={s.livresAnnee} />
                <span className="text-[1rem] font-medium text-encre-45">
                  {" "}
                  / {nombre(objectif)}
                </span>
              </p>
              {objectifAtteint ? (
                <motion.span
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ ...RESSORT_REBOND, delay: 0.5 }}
                  className="rounded-pilule bg-dorure px-2.5 py-1 text-[11px] font-bold text-[#4A3410]"
                >
                  Objectif atteint
                </motion.span>
              ) : (
                <span className="chiffres text-[12px] text-encre-45">
                  {pourcent(ratioObjectif)}
                </span>
              )}
            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-pilule bg-rose-poudre">
              <motion.div
                className="h-full rounded-pilule"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(ratioObjectif * 100)}%` }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                style={{
                  // La dorure est réservée à un seul usage par écran (§7) :
                  // ici, l'objectif atteint. Sinon elle perd tout effet.
                  backgroundImage: objectifAtteint
                    ? "linear-gradient(135deg,#F0CE7A,#E0A83C)"
                    : "var(--degrade-dragee)",
                }}
              />
            </div>
          </div>
        </Section>
      </motion.div>

      {/* ── Chiffres ───────────────────────────────────────────────────── */}
      <motion.div variants={elementCascade}>
        <Section titre="Mes chiffres">
          <motion.div
            variants={conteneurCascade(0.06)}
            className="grid grid-cols-2 gap-2.5"
          >
            <Tuile valeur={s.livresAnnee} libelle={`Livres lus en ${s.annee}`} />
            <Tuile valeur={s.pagesAnnee} libelle="Pages parcourues" />
            <Tuile
              valeur={s.serie}
              libelle={s.serie > 1 ? "Jours d'affilée" : "Jour d'affilée"}
              accent={!objectifAtteint && s.serie >= 7}
            />
            <Tuile
              valeur={
                s.tauxAbandon === null ? 0 : Math.round(s.tauxAbandon * 100)
              }
              suffixe=" %"
              libelle="Taux d'abandon"
            />
          </motion.div>
        </Section>
      </motion.div>

      {/* ── Rythme ─────────────────────────────────────────────────────── */}
      {s.livresAnnee > 0 ? (
        <motion.div variants={elementCascade}>
          <Section titre="Rythme mensuel">
            <div className="rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
              <div className="flex h-28 items-end gap-1.5">
                {s.rythme.map((n, i) => (
                  <div
                    key={i}
                    className="flex flex-1 flex-col items-center gap-1.5"
                  >
                    <div className="flex w-full flex-1 items-end">
                      <motion.div
                        className="w-full rounded-t-[5px]"
                        initial={{ height: 0 }}
                        animate={{
                          height: `${Math.max(n > 0 ? 10 : 3, (n / maxRythme) * 100)}%`,
                        }}
                        transition={{
                          ...RESSORT,
                          delay: 0.2 + i * 0.035,
                        }}
                        style={{
                          backgroundImage:
                            n > 0
                              ? "var(--degrade-dragee)"
                              : "linear-gradient(#EFE6EE,#EFE6EE)",
                        }}
                        title={`${MOIS[i]} : ${pluriel(n, "livre")}`}
                      />
                    </div>
                    <span
                      className={`text-[9.5px] ${
                        i === moisCourant
                          ? "font-bold text-rose-fonce"
                          : "text-encre-45"
                      }`}
                    >
                      {MOIS[i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        </motion.div>
      ) : null}

      {/* ── Palmarès ───────────────────────────────────────────────────── */}
      {s.topAuteurs.length > 0 || s.genreDominant ? (
        <motion.div variants={elementCascade}>
          <Section titre="Cette année">
            <div className="rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
              {s.genreDominant ? (
                <p className="text-[14px]">
                  Genre dominant{" "}
                  <span className="ml-1 rounded-pilule bg-rose-poudre px-2.5 py-1 text-[12.5px] font-semibold text-rose-encre">
                    {s.genreDominant.valeur}
                  </span>
                </p>
              ) : null}

              {/* Ce que tu lis vraiment : le sous-genre quand il est
                  renseigné, le genre sinon. Masqué tant qu'il n'y a qu'une
                  seule entrée, où il répéterait la ligne du dessus. */}
              {s.topClassement.length > 1 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.topClassement.map((c) => (
                    <span
                      key={c.valeur}
                      className="chiffres rounded-pilule bg-rose-voile px-2.5 py-1 text-[12px] font-medium text-encre-70 ring-1 ring-rose-poudre"
                    >
                      {c.valeur}
                      <span className="ml-1.5 text-encre-45">{c.total}</span>
                    </span>
                  ))}
                </div>
              ) : null}

              {s.topAuteurs.length > 0 ? (
                <ul className="mt-3.5 space-y-2">
                  {s.topAuteurs.map((a, i) => (
                    <li
                      key={a.valeur}
                      className="flex items-baseline gap-3 text-[14px]"
                    >
                      <span className="chiffres w-4 shrink-0 font-display text-[13px] font-bold text-rose-fonce">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate">{a.valeur}</span>
                      <span className="chiffres shrink-0 text-[12.5px] text-encre-45">
                        {pluriel(a.total, "livre")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Section>
        </motion.div>
      ) : null}
    </motion.div>
  );
}
