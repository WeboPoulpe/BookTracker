"use client";

import { motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";

import { RESSORT } from "@/lib/anim";

const BASE =
  "w-full rounded-tuile bg-rose-voile px-4 py-3 text-encre ring-1 ring-rose-poudre outline-none transition-[box-shadow,background-color] placeholder:text-encre-45 focus:bg-white focus:ring-2 focus:ring-dragee";

const LABEL = "mb-1.5 block text-[12.5px] font-semibold text-encre-70";

export function Champ({
  label,
  aide,
  erreur,
  className = "",
  ...props
}: ComponentProps<"input"> & {
  label: string;
  aide?: string;
  erreur?: string;
}) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <input
        className={`${BASE} ${erreur ? "ring-2 ring-[#E08AA0]" : ""} ${className}`}
        {...props}
      />
      {erreur ? (
        <span className="mt-1 block text-[12px] text-[#A8324A]">{erreur}</span>
      ) : aide ? (
        <span className="mt-1 block text-[12px] text-encre-45">{aide}</span>
      ) : null}
    </label>
  );
}

/**
 * Champ libre assorti de suggestions.
 *
 * `datalist` plutôt qu'un `select` : le référentiel de sous-genres ne peut
 * pas être exhaustif, et une liste fermée finirait par refuser le livre qu'on
 * tient en main. Le contrôle natif reste par ailleurs le plus confortable sur
 * mobile, où un menu maison se bat contre le clavier.
 */
export function ChampSuggestions({
  label,
  aide,
  suggestions,
  id,
  className = "",
  ...props
}: ComponentProps<"input"> & {
  label: string;
  aide?: string;
  suggestions: string[];
  id: string;
}) {
  const listeId = `${id}-suggestions`;

  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <input
        list={suggestions.length ? listeId : undefined}
        autoComplete="off"
        className={`${BASE} ${className}`}
        {...props}
      />
      {suggestions.length ? (
        <datalist id={listeId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
      {aide ? (
        <span className="mt-1 block text-[12px] text-encre-45">{aide}</span>
      ) : null}
    </label>
  );
}

export function ZoneTexte({
  label,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { label: string }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <textarea className={`${BASE} resize-y ${className}`} {...props} />
    </label>
  );
}

export function Selecteur({
  label,
  children,
  className = "",
  ...props
}: ComponentProps<"select"> & { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <select className={`${BASE} appearance-none ${className}`} {...props}>
        {children}
      </select>
    </label>
  );
}

/**
 * Groupe de choix exclusifs, façon segmented control iOS.
 *
 * L'indicateur glisse d'une option à l'autre via `layoutId` : un simple
 * changement de fond donnerait un saut, et c'est précisément ce saut qui
 * fait « site web » plutôt qu'« application ».
 */
export function Segments<T extends string>({
  label,
  valeur,
  onChange,
  options,
  id = "segments",
}: {
  label?: string;
  valeur: T;
  onChange: (v: T) => void;
  options: Array<{ valeur: T; libelle: string }>;
  /** Distingue plusieurs groupes présents en même temps à l'écran */
  id?: string;
}) {
  return (
    <div>
      {label ? <span className={LABEL}>{label}</span> : null}
      <div
        role="tablist"
        className="flex gap-1 rounded-pilule bg-rose-voile p-1 ring-1 ring-rose-poudre"
      >
        {options.map((o) => {
          const actif = o.valeur === valeur;
          return (
            <button
              key={o.valeur}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => onChange(o.valeur)}
              className="relative min-h-[38px] flex-1 rounded-pilule px-2 text-[13px] font-semibold"
            >
              {actif ? (
                <motion.span
                  layoutId={`segment-${id}`}
                  aria-hidden="true"
                  className="degrade-dragee absolute inset-0 rounded-pilule shadow-dragee"
                  transition={RESSORT}
                />
              ) : null}
              <span
                className={`relative ${actif ? "text-rose-encre" : "text-encre-45"}`}
              >
                {o.libelle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
