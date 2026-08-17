"use client";

import { useEffect, useId, useState } from "react";

import { Champ } from "@/components/ui/Champ";
import { normaliser } from "@/lib/texte";

/**
 * Champ « série », complété par les séries déjà créées.
 *
 * Une série se crée par la simple saisie de son nom, et le rapprochement se
 * fait sur ce nom : « Les Sept Soeurs » saisi à la main là où la bibliothèque
 * connaît « Les Sept Sœurs » donnerait deux séries au lieu d'une, chacune
 * avec la moitié des tomes. Le suivi des tomes serait faux sans qu'aucun
 * écran ne le signale — c'est le genre d'erreur qu'on ne découvre qu'en
 * cherchant pourquoi le prochain tome proposé n'est pas le bon.
 *
 * Deux garde-fous plutôt qu'un : la liste propose l'existant, et la saisie
 * libre est ramenée sur le nom déjà en base dès qu'elle lui correspond aux
 * accents et à la casse près. Le premier suffit quand on choisit dans la
 * liste, le second rattrape quand on tape sans regarder.
 */

/**
 * Chargement partagé par toutes les instances.
 *
 * Le formulaire d'ajout et celui d'édition montent le champ séparément ;
 * sans ce cache, ouvrir l'un puis l'autre redemanderait la même liste.
 */
let enCache: Promise<string[]> | null = null;

function chargerNoms(): Promise<string[]> {
  enCache ??= fetch("/api/series")
    .then((r) => (r.ok ? r.json() : { noms: [] }))
    .then((d: { noms?: string[] }) => d.noms ?? [])
    // Hors ligne et sans cache du service worker : le champ reste une saisie
    // libre, ce qu'il était de toute façon avant.
    .catch(() => []);
  return enCache;
}

/** À appeler après avoir créé une série, pour que la suivante la propose. */
export function oublierSeries() {
  enCache = null;
}

export function ChampSerie({
  value,
  onChange,
  className = "",
  label = "Série",
  aide,
  placeholder,
}: {
  value: string;
  onChange: (valeur: string) => void;
  className?: string;
  label?: string;
  /** Prend le pas sur le décompte des séries — l'écran sait mieux que nous. */
  aide?: string;
  placeholder?: string;
}) {
  const idListe = useId();
  const [noms, setNoms] = useState<string[]>([]);

  useEffect(() => {
    let vivant = true;
    chargerNoms().then((n) => {
      if (vivant) setNoms(n);
    });
    return () => {
      vivant = false;
    };
  }, []);

  /**
   * Ramène la saisie sur l'orthographe déjà en base.
   *
   * Au flou plutôt qu'à la frappe : corriger pendant qu'on tape déplacerait
   * le curseur et rendrait le champ impossible à remplir.
   */
  function aligner() {
    const propre = value.trim();
    if (!propre) return;

    const cle = normaliser(propre);
    const connu = noms.find((n) => normaliser(n) === cle);
    if (connu && connu !== propre) onChange(connu);
    else if (propre !== value) onChange(propre);
  }

  return (
    <>
      <Champ
        label={label}
        list={idListe}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={aligner}
        autoComplete="off"
        placeholder={placeholder}
        aide={
          aide ??
          (noms.length > 0
            ? `${noms.length} série${noms.length > 1 ? "s" : ""} existante${noms.length > 1 ? "s" : ""}`
            : undefined)
        }
        className={className}
      />
      <datalist id={idListe}>
        {noms.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </>
  );
}
