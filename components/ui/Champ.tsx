import type { ComponentProps, ReactNode } from "react";

const BASE =
  "w-full rounded-carte border border-bordure bg-papier-doux px-3.5 py-2.5 text-encre placeholder:text-encre-45 outline-none transition-[border-color,background-color] focus:border-tranche focus:bg-papier";

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
      <span className="mb-1.5 block text-[13px] font-medium text-encre-70">
        {label}
      </span>
      <input
        className={`${BASE} ${erreur ? "border-[#C4526A]" : ""} ${className}`}
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

export function ZoneTexte({
  label,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-encre-70">
        {label}
      </span>
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
      <span className="mb-1.5 block text-[13px] font-medium text-encre-70">
        {label}
      </span>
      <select className={`${BASE} appearance-none ${className}`} {...props}>
        {children}
      </select>
    </label>
  );
}

/** Groupe de choix exclusifs, façon segmented control iOS. */
export function Segments<T extends string>({
  label,
  valeur,
  onChange,
  options,
}: {
  label?: string;
  valeur: T;
  onChange: (v: T) => void;
  options: Array<{ valeur: T; libelle: string }>;
}) {
  return (
    <div>
      {label ? (
        <span className="mb-1.5 block text-[13px] font-medium text-encre-70">
          {label}
        </span>
      ) : null}
      <div
        role="tablist"
        className="flex gap-1 rounded-pilule bg-papier-doux p-1"
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
              className={`min-h-[36px] flex-1 rounded-pilule px-2 text-[13px] font-medium transition-colors ${
                actif ? "bg-encre text-velin" : "text-encre-70 active:bg-encre/5"
              }`}
            >
              {o.libelle}
            </button>
          );
        })}
      </div>
    </div>
  );
}
