"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { Couverture } from "@/components/Couverture";
import { BoutonLien } from "@/components/ui/Bouton";
import { Compteur } from "@/components/ui/Compteur";
import { EtatVide, Section } from "@/components/ui/EnTete";
import type { Accueil } from "@/db/requetes/stats";
import {
  RESSORT,
  RESSORT_REBOND,
  TOUCHER,
  TOUCHER_DOUX,
  conteneurCascade,
  elementCascade,
} from "@/lib/anim";
import { depuis, nombre, pluriel, pourcent, progression } from "@/lib/format";

const LienAnime = motion.create(Link);
const MOIS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * Anneau de progression vers l'objectif annuel.
 *
 * Un anneau plutôt qu'une barre : c'est la seule figure de l'écran, elle
 * mérite d'être regardée, et la forme fermée dit « objectif » là où une barre
 * dit « chargement ». Le tracé est un cercle SVG dont on anime le pointillé.
 */
function Anneau({
  ratio,
  atteint,
  enfants,
}: {
  ratio: number;
  atteint: boolean;
  enfants: React.ReactNode;
}) {
  const rayon = 54;
  const perimetre = 2 * Math.PI * rayon;

  return (
    <div className="relative h-[136px] w-[136px] shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={rayon}
          fill="none"
          stroke="var(--color-rose-poudre)"
          strokeWidth="11"
        />
        <motion.circle
          cx="64"
          cy="64"
          r={rayon}
          fill="none"
          stroke={atteint ? "#E0A83C" : "#BC5C85"}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={perimetre}
          initial={{ strokeDashoffset: perimetre }}
          animate={{ strokeDashoffset: perimetre * (1 - ratio) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {enfants}
      </div>
    </div>
  );
}

/** Petite pastille de statistique, cliquable vers l'écran Statistiques. */
function Pastille({
  valeur,
  suffixe,
  libelle,
  href,
}: {
  valeur: number | null;
  suffixe?: string;
  libelle: string;
  href: string;
}) {
  return (
    <LienAnime
      href={href}
      variants={elementCascade}
      whileTap={TOUCHER}
      transition={RESSORT}
      className="rounded-tuile bg-white/85 px-3.5 py-3 shadow-carte ring-1 ring-white/70 backdrop-blur-sm"
    >
      <p className="chiffres font-display text-[1.45rem] leading-none font-bold text-encre">
        {valeur === null ? "—" : <Compteur valeur={valeur} />}
        {valeur !== null && suffixe ? (
          <span className="text-[0.95rem]">{suffixe}</span>
        ) : null}
      </p>
      <p className="mt-1 text-[11px] leading-tight font-medium text-encre-45">
        {libelle}
      </p>
    </LienAnime>
  );
}

/** Encouragement fondé sur l'avancement réel, jamais sur du vide. */
function phrase(livres: number, objectif: number, restants: number): string {
  if (objectif <= 0) return "Bonne lecture.";
  if (livres === 0) return "L'année commence. Premier livre ?";
  if (livres >= objectif) return "Objectif atteint. Le reste est du bonus.";
  if (restants === 1) return "Plus qu'un livre.";
  if (livres / objectif >= 0.75) return `Plus que ${restants} livres.`;
  if (livres / objectif >= 0.5) return "La moitié est passée.";
  return `${restants} livres pour y arriver.`;
}

export function TableauDeBord({
  donnees,
  objectif,
}: {
  donnees: Accueil;
  objectif: number;
}) {
  const { stats, enCours, annee, total } = donnees;

  const ratio = objectif > 0 ? Math.min(1, stats.livresLus / objectif) : 0;
  const atteint = stats.livresLus >= objectif && objectif > 0;
  const restants = Math.max(0, objectif - stats.livresLus);

  const maxMois = Math.max(1, ...stats.serieTemporelle.map((m) => m.livres));
  const moisCourant = new Date().getMonth();

  return (
    <motion.div
      initial="masque"
      animate="visible"
      variants={conteneurCascade(0.07)}
      className="space-y-7 px-5 pb-8"
    >
      {/* ── Objectif, en tête d'écran ──────────────────────────────────── */}
      <motion.div variants={elementCascade}>
        <div className="flex items-center gap-4 rounded-feuille bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
          <Anneau
            ratio={ratio}
            atteint={atteint}
            enfants={
              <>
                <span className="chiffres font-display text-[2.5rem] leading-none font-bold text-encre">
                  <Compteur valeur={stats.livresLus} />
                </span>
                <span className="chiffres mt-0.5 text-[12px] font-medium text-encre-45">
                  / {nombre(objectif)}
                </span>
              </>
            }
          />

          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-bold tracking-[0.14em] text-rose-fonce uppercase">
              Objectif {annee}
            </p>
            <p className="mt-1.5 font-lecture text-[17px] leading-snug text-encre">
              {phrase(stats.livresLus, objectif, restants)}
            </p>

            {atteint ? (
              <motion.p
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...RESSORT_REBOND, delay: 0.6 }}
                className="mt-2 inline-block rounded-pilule bg-dorure px-2.5 py-1 text-[11px] font-bold text-[#4A3410]"
              >
                ✦ Bravo
              </motion.p>
            ) : (
              <p className="chiffres mt-2 text-[12.5px] text-encre-45">
                {pourcent(ratio)} du chemin
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── En cours ───────────────────────────────────────────────────── */}
      <motion.div variants={elementCascade}>
        <Section titre="En cours de lecture">
          {enCours.length === 0 ? (
            <EtatVide
              titre="Aucun livre en cours."
              texte={
                total > 0
                  ? "Ouvre ta bibliothèque et reprends là où tu en étais."
                  : "Importe ta bibliothèque Goodreads, ou ajoute un premier livre."
              }
              action={
                <BoutonLien
                  href={total > 0 ? "/bibliotheque" : "/reglages/import"}
                  taille="sm"
                >
                  {total > 0 ? "Voir ma bibliothèque" : "Importer Goodreads"}
                </BoutonLien>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {enCours.map((l, i) => {
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
                      priorite={i === 0}
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

                      {l.derniereSession ? (
                        <p className="mt-1 text-[11px] text-encre-45">
                          Dernière page {depuis(l.derniereSession)}
                        </p>
                      ) : null}
                    </div>
                  </LienAnime>
                );
              })}
            </div>
          )}
        </Section>
      </motion.div>

      {/* ── Chiffres de l'année ────────────────────────────────────────── */}
      <motion.div variants={elementCascade}>
        <Section
          titre={`Cette année`}
          action={
            <Link
              href={`/statistiques?annee=${annee}`}
              className="text-[12px] font-semibold text-rose-fonce"
            >
              Tout voir
            </Link>
          }
        >
          <motion.div
            variants={conteneurCascade(0.05)}
            className="grid grid-cols-3 gap-2.5"
          >
            <Pastille
              valeur={stats.pagesLues}
              libelle="Pages lues"
              href={`/statistiques?annee=${annee}`}
            />
            <Pastille
              valeur={stats.joursMoyens}
              suffixe=" j"
              libelle="Pour finir un livre"
              href={`/statistiques?annee=${annee}`}
            />
            <Pastille
              valeur={
                stats.tauxAbandon === null
                  ? null
                  : Math.round(stats.tauxAbandon * 100)
              }
              suffixe=" %"
              libelle="Taux d'abandon"
              href={`/statistiques?annee=${annee}`}
            />
          </motion.div>
        </Section>
      </motion.div>

      {/* ── Rythme, en aperçu ──────────────────────────────────────────── */}
      {stats.livresLus > 0 ? (
        <motion.div variants={elementCascade}>
          <Section titre="Ton rythme">
            <Link
              href={`/statistiques?annee=${annee}`}
              className="block rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm"
            >
              <div className="flex h-16 items-end gap-1.5">
                {stats.serieTemporelle.map((m, i) => (
                  <div
                    key={m.cle}
                    className="flex flex-1 flex-col items-center gap-1"
                  >
                    <div className="flex w-full flex-1 items-end">
                      <motion.div
                        className="w-full rounded-t-[3px]"
                        style={{
                          backgroundColor:
                            i === moisCourant ? "#75294A" : "#BC5C85",
                          opacity: m.livres > 0 ? 1 : 0.2,
                        }}
                        initial={{ height: 0 }}
                        animate={{
                          height: `${Math.max((m.livres / maxMois) * 100, m.livres > 0 ? 8 : 4)}%`,
                        }}
                        transition={{ ...RESSORT, delay: 0.2 + i * 0.03 }}
                      />
                    </div>
                    <span
                      className={`text-[9px] leading-none ${
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
              <p className="chiffres mt-2.5 text-[12px] text-encre-45">
                {stats.moyenneParMois !== null
                  ? `${stats.moyenneParMois.toLocaleString("fr-FR")} livres par mois en moyenne`
                  : null}
              </p>
            </Link>
          </Section>
        </motion.div>
      ) : null}

      {/* ── Ce que tu lis ──────────────────────────────────────────────── */}
      {stats.parGenre.length > 0 ? (
        <motion.div variants={elementCascade}>
          <Section titre="Ce que tu lis">
            <div className="rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
              <div className="flex flex-wrap gap-1.5">
                {stats.parGenre.slice(0, 6).map((g) => (
                  <Link
                    key={g.cle}
                    href={`/bibliotheque?annee=${annee}&genre=${encodeURIComponent(g.cle)}&retour=${encodeURIComponent(`/statistiques?annee=${annee}`)}`}
                    className="chiffres rounded-pilule bg-rose-voile px-3 py-1.5 text-[12.5px] font-medium text-encre-70 ring-1 ring-rose-poudre"
                  >
                    {g.libelle}
                    <span className="ml-1.5 text-rose-fonce">{g.total}</span>
                  </Link>
                ))}
              </div>

              {stats.parAuteur.length > 0 ? (
                <p className="mt-3 text-[13px] text-encre-70">
                  Le plus lu :{" "}
                  <span className="font-semibold">
                    {stats.parAuteur[0].libelle}
                  </span>
                  <span className="text-encre-45">
                    {" "}
                    · {pluriel(stats.parAuteur[0].total, "livre")}
                  </span>
                </p>
              ) : null}
            </div>
          </Section>
        </motion.div>
      ) : null}
    </motion.div>
  );
}
