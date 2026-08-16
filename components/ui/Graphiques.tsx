"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { RESSORT } from "@/lib/anim";
import { nombre } from "@/lib/format";

/**
 * Primitives de graphique.
 *
 * Toutes les séries sont des comparaisons de grandeur à série unique : elles
 * portent donc **une seule teinte**, et c'est la longueur de la barre qui dit
 * la valeur. Colorer chaque barre différemment dépenserait le canal d'identité
 * à répéter ce que la longueur montre déjà.
 *
 * Teintes issues d'une rampe rose validée (monotonie de clarté, écart de
 * clarté ≥ 0,06, extrémité claire ≥ 2:1 sur blanc, teinte unique) :
 *   #E09BBB · #CE7BA0 · #BC5C85 · #9C4269 · #75294A
 * `#BC5C85` sert de teinte de magnitude, à 4,19:1 sur blanc.
 */

export const MAGNITUDE = "#BC5C85";
/** Rampe ordinale, du plus court au plus long. */
export const RAMPE = ["#E09BBB", "#BC5C85", "#75294A"];

export type Barre = {
  cle: string;
  libelle: string;
  valeur: number;
  /** Destination au clic — les livres que cette barre compte */
  href?: string;
  /** Couleur de la barre ; la teinte de magnitude par défaut */
  couleur?: string;
  /** Pastille de rappel, sans rôle d'identité (le libellé porte le sens) */
  pastille?: string;
};

function Enveloppe({
  href,
  children,
  titre,
}: {
  href?: string;
  children: React.ReactNode;
  titre: string;
}) {
  if (!href) return <div className="block w-full">{children}</div>;
  return (
    <Link href={href} title={titre} className="block w-full">
      {children}
    </Link>
  );
}

/**
 * Barres horizontales, une par catégorie.
 *
 * Horizontal et non vertical : les libellés sont des noms de genres et
 * d'auteurs, illisibles à la verticale ou tronqués sous un axe.
 */
export function BarresHorizontales({
  barres,
  unite = "livre",
  max,
}: {
  barres: Barre[];
  unite?: string;
  max?: number;
}) {
  const plafond = max ?? Math.max(1, ...barres.map((b) => b.valeur));

  if (barres.every((b) => b.valeur === 0)) {
    return (
      <p className="py-3 text-[13px] text-encre-45">
        Rien à afficher sur cette période.
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {barres.map((b, i) => {
        const part = b.valeur / plafond;
        return (
          <li key={b.cle}>
            <Enveloppe
              href={b.valeur > 0 ? b.href : undefined}
              titre={`${b.libelle} — ${nombre(b.valeur)} ${unite}${b.valeur > 1 ? "s" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-encre-70">
                  {b.pastille ? (
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: b.pastille }}
                    />
                  ) : null}
                  <span className="truncate">{b.libelle}</span>
                </span>
                {/* Étiquette directe sur chaque barre : c'est elle qui rend
                    la valeur lisible même quand la barre est très courte. */}
                <span className="chiffres shrink-0 text-[13px] font-semibold text-encre">
                  {nombre(b.valeur)}
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-[4px] bg-rose-voile">
                <motion.div
                  className="h-full rounded-[4px]"
                  style={{ backgroundColor: b.couleur ?? MAGNITUDE }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(part * 100, b.valeur > 0 ? 2 : 0)}%` }}
                  transition={{ ...RESSORT, delay: 0.05 + i * 0.03 }}
                />
              </div>
            </Enveloppe>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Colonnes verticales pour une série temporelle.
 *
 * Une seule mesure par graphique : livres et pages ne partagent jamais un
 * cadre. Deux échelles sur un même axe est l'erreur de lecture la plus
 * fréquente, et elle laisse croire à des corrélations inventées.
 */
export function Colonnes({
  barres,
  unite,
  surligne,
  hauteur = "h-24",
  valeurs = true,
}: {
  barres: Barre[];
  unite: string;
  /** Clé mise en avant — le mois consulté, par exemple */
  surligne?: string | null;
  /**
   * Hauteur de la zone de tracé, en classe Tailwind.
   *
   * Elle doit rester explicite : le conteneur est en `items-end`, donc une
   * colonne sans hauteur propre se réduit à celle de son libellé et les
   * barres disparaissent. Un `flex-1` n'y suffit pas.
   */
  hauteur?: string;
  /** Chiffre au-dessus de chaque colonne ; encombrant en aperçu réduit */
  valeurs?: boolean;
}) {
  const plafond = Math.max(1, ...barres.map((b) => b.valeur));

  return (
    <div className="rail-horizontal -mx-1 px-1">
      <div className="flex min-w-full items-end gap-1.5">
        {barres.map((b, i) => {
          const part = b.valeur / plafond;
          const enAvant = surligne != null && b.cle === surligne;
          return (
            <Enveloppe
              key={b.cle}
              href={b.valeur > 0 ? b.href : undefined}
              titre={`${b.libelle} — ${nombre(b.valeur)} ${unite}${
                b.valeur > 1 && !unite.endsWith("s") ? "s" : ""
              }`}
            >
              <div className="flex min-w-[22px] flex-1 flex-col items-center gap-1">
                {valeurs ? (
                  <span
                    className={`chiffres text-[10px] leading-none ${
                      b.valeur > 0 ? "text-encre-70" : "text-transparent"
                    }`}
                  >
                    {b.valeur > 0 ? nombre(b.valeur) : "0"}
                  </span>
                ) : null}
                <div className={`flex w-full items-end ${hauteur}`}>
                  <motion.div
                    className="w-full rounded-t-[4px]"
                    style={{
                      backgroundColor: enAvant ? "#75294A" : MAGNITUDE,
                      opacity: b.valeur > 0 ? 1 : 0.18,
                    }}
                    initial={{ height: 0 }}
                    animate={{
                      height: `${Math.max(part * 100, b.valeur > 0 ? 4 : 3)}%`,
                    }}
                    transition={{ ...RESSORT, delay: 0.05 + i * 0.025 }}
                  />
                </div>
                <span
                  className={`text-[9.5px] leading-none ${
                    enAvant ? "font-bold text-rose-encre" : "text-encre-45"
                  }`}
                >
                  {b.libelle}
                </span>
              </div>
            </Enveloppe>
          );
        })}
      </div>
    </div>
  );
}
