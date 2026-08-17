"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { Compteur } from "@/components/ui/Compteur";
import { Section } from "@/components/ui/EnTete";
import {
  BarresHorizontales,
  Colonnes,
  RAMPE,
  type Barre,
} from "@/components/ui/Graphiques";
import type { Statistiques as Stats } from "@/db/requetes/statistiques";
import { RESSORT, TOUCHER, conteneurCascade, elementCascade } from "@/lib/anim";
import { nombre, pluriel } from "@/lib/format";
import { resoudreGenre } from "@/lib/genres";

const LienAnime = motion.create(Link);

const MOIS_LONGS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

/** URL des statistiques pour une portée donnée. */
function urlStatistiques(annee: number | null, mois: number | null) {
  const p = new URLSearchParams();
  if (annee !== null) p.set("annee", String(annee));
  if (mois !== null) p.set("mois", String(mois));
  const q = p.toString();
  return q ? `/statistiques?${q}` : "/statistiques";
}

/**
 * Construit une URL de bibliothèque filtrée, en gardant la portée courante.
 *
 * Le paramètre `retour` transporte l'écran d'origine : arrivé ici par un
 * graphique, on veut retourner au graphique, pas élargir le filtre. Le
 * déduire des filtres présents serait fragile — les mêmes paramètres peuvent
 * venir d'ailleurs.
 */
function lien(
  portee: Stats["portee"],
  extra: Record<string, string | number | undefined>,
  /** Portée d'origine, quand elle diffère de celle visée par le lien */
  origine?: { annee: number | null; mois: number | null },
) {
  const p = new URLSearchParams();
  if (portee.annee !== null) p.set("annee", String(portee.annee));
  if (portee.mois !== null) p.set("mois", String(portee.mois));
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  p.set(
    "retour",
    urlStatistiques(
      origine ? origine.annee : portee.annee,
      origine ? origine.mois : portee.mois,
    ),
  );
  return `/bibliotheque?${p.toString()}`;
}

function Tuile({
  valeur,
  suffixe,
  libelle,
  detail,
  className = "",
}: {
  valeur: number | null;
  suffixe?: string;
  libelle: string;
  detail?: string;
  className?: string;
}) {
  return (
    <motion.div
      variants={elementCascade}
      className={`rounded-tuile bg-white/85 px-4 py-3.5 shadow-carte ring-1 ring-white/70 backdrop-blur-sm ${className}`}
    >
      <p className="chiffres font-display text-[1.7rem] leading-none font-bold text-encre">
        {valeur === null ? "—" : <Compteur valeur={valeur} />}
        {valeur !== null && suffixe ? (
          <span className="text-[1.05rem]">{suffixe}</span>
        ) : null}
      </p>
      <p className="mt-1.5 text-[11.5px] leading-tight font-medium text-encre-45">
        {libelle}
      </p>
      {detail ? (
        <p className="chiffres mt-0.5 text-[11px] text-rose-fonce">{detail}</p>
      ) : null}
    </motion.div>
  );
}

export function Statistiques({ stats: s }: { stats: Stats }) {
  const { portee } = s;

  const longueurs: Barre[] = s.parLongueur.map((t, i) => ({
    cle: t.cle,
    libelle: t.libelle,
    valeur: t.total,
    // Rampe ordinale : la couleur redit l'épaisseur du livre, qui est
    // justement ce que la tranche mesure.
    couleur: RAMPE[i],
    href: lien(portee, { pages: t.cle }),
  }));

  const genres: Barre[] = s.parGenre.map((t) => ({
    cle: t.cle,
    libelle: t.libelle,
    valeur: t.total,
    pastille: resoudreGenre(t.cle).couleur,
    href: lien(portee, { genre: t.cle }),
  }));

  const formats: Barre[] = s.parFormat.map((t) => ({
    cle: t.cle,
    libelle: t.libelle,
    valeur: t.total,
    href: lien(portee, { format: t.cle }),
  }));

  const auteurs: Barre[] = s.parAuteur.map((t) => ({
    cle: t.cle,
    libelle: t.libelle,
    valeur: t.total,
    href: lien(portee, { auteur: t.cle }),
  }));

  const notes: Barre[] = s.parNote.map((t) => ({
    cle: t.cle,
    libelle: `${t.libelle} ★`,
    valeur: t.total,
    href: lien(portee, { note: t.cle }),
  }));

  const parMois = (mesure: "livres" | "pages"): Barre[] =>
    s.serieTemporelle.map((m) => ({
      cle: m.cle,
      libelle: m.libelle,
      valeur: m[mesure],
      // La colonne pointe vers sa propre période, mais le retour ramène à la
      // portée qu'on regardait, pas à celle de la colonne cliquée.
      href:
        s.granularite === "mois"
          ? lien({ annee: portee.annee, mois: Number(m.cle) }, {}, portee)
          : lien({ annee: Number(m.cle), mois: null }, {}, portee),
    }));

  const intitulePeriode =
    portee.annee === null
      ? "Depuis le début"
      : portee.mois !== null
        ? `${MOIS_LONGS[portee.mois - 1]} ${portee.annee}`
        : String(portee.annee);

  return (
    <motion.div
      initial="masque"
      animate="visible"
      variants={conteneurCascade(0.06)}
      className="space-y-7 px-5 pb-8"
    >
      {/* ── Chiffres clés ─────────────────────────────────────────────── */}
      <motion.div variants={elementCascade}>
        <Section titre={intitulePeriode}>
          <motion.div
            variants={conteneurCascade(0.05)}
            className="grid grid-cols-2 gap-2.5"
          >
            <Tuile
              valeur={s.livresLus}
              libelle="Livres lus"
              detail={
                s.moyenneParMois !== null
                  ? `${s.moyenneParMois.toLocaleString("fr-FR")} par mois`
                  : undefined
              }
            />
            <Tuile
              valeur={s.pagesLues}
              libelle="Pages lues"
              detail={
                s.moyennePages !== null
                  ? `${nombre(s.moyennePages)} par livre`
                  : undefined
              }
            />
            <Tuile
              valeur={s.joursMoyens}
              suffixe=" j"
              libelle="Pour finir un livre"
              detail="en moyenne"
            />
            <Tuile
              valeur={s.parGenre.length}
              libelle="Genres parcourus"
              detail={s.parGenre[0]?.libelle}
            />
            {/* Sur toute la largeur : c'est le seul taux au milieu de quatre
                comptes, et le seul dont le chiffre ne veut rien dire sans son
                dénominateur — qui tient alors sur une ligne. */}
            <Tuile
              className="col-span-2"
              valeur={
                s.tauxAbandon === null ? null : Math.round(s.tauxAbandon * 100)
              }
              suffixe=" %"
              libelle="Taux d'abandon"
              detail={
                s.tauxAbandon === null
                  ? "aucune lecture menée à son terme"
                  : `${pluriel(s.abandons, "abandon")} sur ${nombre(s.abandons + s.livresLus)} ${s.abandons + s.livresLus > 1 ? "lectures terminées" : "lecture terminée"}`
              }
            />
          </motion.div>
        </Section>
      </motion.div>

      {/* ── Série temporelle : deux mesures, deux graphiques ───────────── */}
      <motion.div variants={elementCascade}>
        <Section
          titre={
            s.granularite === "mois" ? "Livres par mois" : "Livres par année"
          }
        >
          <div className="rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
            <Colonnes
              barres={parMois("livres")}
              unite="livre"
              surligne={portee.mois !== null ? String(portee.mois) : null}
            />
          </div>
        </Section>
      </motion.div>

      <motion.div variants={elementCascade}>
        <Section
          titre={s.granularite === "mois" ? "Pages par mois" : "Pages par année"}
        >
          <div className="rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
            {/* Graphique distinct et non second axe : superposer livres et
                pages sur deux échelles laisse lire des corrélations qui
                n'existent pas. */}
            <Colonnes
              barres={parMois("pages")}
              unite="pages"
              surligne={portee.mois !== null ? String(portee.mois) : null}
            />
          </div>
        </Section>
      </motion.div>

      {/* ── Répartitions ──────────────────────────────────────────────── */}
      <motion.div variants={elementCascade}>
        <Section titre="Longueur des livres">
          <div className="rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
            <BarresHorizontales barres={longueurs} />
          </div>
        </Section>
      </motion.div>

      <motion.div variants={elementCascade}>
        <Section titre="Par genre">
          <div className="rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
            <BarresHorizontales barres={genres} />
          </div>
        </Section>
      </motion.div>

      <motion.div variants={elementCascade}>
        <Section titre="Par format">
          <div className="rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
            <BarresHorizontales barres={formats} />
          </div>
        </Section>
      </motion.div>

      <motion.div variants={elementCascade}>
        <Section titre="Auteurs les plus lus">
          <div className="rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
            <BarresHorizontales barres={auteurs} />
          </div>
        </Section>
      </motion.div>

      <motion.div variants={elementCascade}>
        <Section titre="Par note">
          <div className="rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
            {notes.length === 0 ? (
              <p className="text-[13px] text-encre-45">
                Aucun livre noté sur cette période.
              </p>
            ) : (
              <BarresHorizontales barres={notes} />
            )}
          </div>
        </Section>
      </motion.div>

      <motion.p
        variants={elementCascade}
        className="px-1 text-[12px] leading-relaxed text-encre-45"
      >
        Chaque barre renvoie aux livres qu&apos;elle compte. Les lectures
        abandonnées sont exclues, et une relecture compte pour deux.
      </motion.p>
    </motion.div>
  );
}

/** Sélecteur d'année et de mois, en rail horizontal. */
export function PorteeStatistiques({
  portee,
  annees,
}: {
  portee: Stats["portee"];
  annees: number[];
}) {
  return (
    <div className="space-y-2 px-5 pb-2">
      <div className="rail-horizontal -mx-5 px-5">
        <div className="flex w-max gap-2">
          {[null, ...annees].map((a) => {
            const actif = portee.annee === a;
            return (
              <LienAnime
                key={a ?? "toutes"}
                href={urlStatistiques(a, null)}
                scroll={false}
                whileTap={TOUCHER}
                transition={RESSORT}
                className={`relative flex min-h-[38px] items-center rounded-pilule px-4 text-[13px] font-semibold whitespace-nowrap ${
                  actif
                    ? "text-rose-encre"
                    : "bg-white/70 text-encre-70 ring-1 ring-white/80 backdrop-blur-sm"
                }`}
              >
                {actif ? (
                  <motion.span
                    layoutId="pastille-annee"
                    aria-hidden="true"
                    className="degrade-dragee absolute inset-0 rounded-pilule shadow-dragee"
                    transition={RESSORT}
                  />
                ) : null}
                <span className="relative">{a === null ? "Tout" : a}</span>
              </LienAnime>
            );
          })}
        </div>
      </div>

      {/* Les mois n'apparaissent qu'une fois une année choisie : « mars »
          n'a pas de sens sur une portée pluriannuelle. */}
      {portee.annee !== null ? (
        <div className="rail-horizontal -mx-5 px-5">
          <div className="flex w-max gap-1.5">
            {[null, ...Array.from({ length: 12 }, (_, i) => i + 1)].map((m) => {
              const actif = portee.mois === m;
              return (
                <Link
                  key={m ?? "annee"}
                  href={urlStatistiques(portee.annee, m)}
                  scroll={false}
                  className={`flex min-h-[34px] items-center rounded-pilule px-3 text-[12px] font-medium whitespace-nowrap ${
                    actif
                      ? "bg-encre text-velin"
                      : "bg-white/60 text-encre-45 ring-1 ring-white/80"
                  }`}
                >
                  {m === null ? "Année entière" : MOIS_LONGS[m - 1].slice(0, 4)}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
