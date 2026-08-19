"use client";

import { useEffect, useRef, useState } from "react";

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
 * La liste est construite ici, et non déléguée à `<datalist>` : Safari iOS
 * n'en affiche aucune, et cette app se consulte au téléphone. Le champ
 * paraissait donc dépourvu d'autocomplétion, alors que les noms étaient bien
 * chargés.
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
    .catch(() => {
      // Hors ligne, ou route en échec : le champ reste une saisie libre, ce
      // qu'il était de toute façon avant. On oublie l'échec pour que la
      // prochaine ouverture réessaie, au lieu de rester vide à jamais.
      enCache = null;
      return [];
    });
  return enCache;
}

/** À appeler après avoir créé une série, pour que la suivante la propose. */
export function oublierSeries() {
  enCache = null;
}

/** Au-delà, la liste cesse d'aider : on tape deux lettres de plus. */
const MAX_PROPOSITIONS = 6;

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
  const [noms, setNoms] = useState<string[]>([]);
  const [ouvert, setOuvert] = useState(false);
  // Le survol du doigt ne dit rien : sans ce drapeau, le flou du champ ferme
  // la liste avant que le choix ne soit enregistré.
  const choixEnCours = useRef(false);

  useEffect(() => {
    let vivant = true;
    chargerNoms().then((n) => {
      if (vivant) setNoms(n);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const cle = normaliser(value);
  const propositions = noms
    .filter((n) => {
      const c = normaliser(n);
      // Un nom déjà saisi à l'identique n'a pas à être proposé : la liste
      // resterait ouverte sur une seule ligne, sans rien apporter.
      if (c === cle) return false;
      return cle === "" || c.includes(cle);
    })
    .slice(0, MAX_PROPOSITIONS);

  /**
   * Ramène la saisie sur l'orthographe déjà en base.
   *
   * Au flou plutôt qu'à la frappe : corriger pendant qu'on tape déplacerait
   * le curseur et rendrait le champ impossible à remplir.
   */
  function aligner() {
    const propre = value.trim();
    if (!propre) return;

    const connu = noms.find((n) => normaliser(n) === normaliser(propre));
    if (connu && connu !== propre) onChange(connu);
    else if (propre !== value) onChange(propre);
  }

  function choisir(nom: string) {
    onChange(nom);
    setOuvert(false);
    choixEnCours.current = false;
  }

  return (
    <div className={`relative ${className}`}>
      <Champ
        label={label}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOuvert(true);
        }}
        onFocus={() => setOuvert(true)}
        onBlur={() => {
          if (choixEnCours.current) return;
          setOuvert(false);
          aligner();
        }}
        autoComplete="off"
        placeholder={placeholder}
        aide={
          aide ??
          (noms.length > 0
            ? `${noms.length} série${noms.length > 1 ? "s" : ""} existante${noms.length > 1 ? "s" : ""}`
            : undefined)
        }
      />

      {ouvert && propositions.length > 0 ? (
        <ul
          // `onPointerDown` et non `onClick` : au doigt comme à la souris, le
          // flou du champ précède le clic. Retenir le pointeur dès l'appui
          // empêche la liste de se fermer sous le doigt.
          onPointerDown={() => {
            choixEnCours.current = true;
          }}
          className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-tuile bg-white shadow-carte ring-1 ring-bordure"
        >
          {propositions.map((n) => (
            <li key={n}>
              <button
                type="button"
                onClick={() => choisir(n)}
                className="block w-full truncate px-3 py-2.5 text-left text-[13.5px] text-encre-70 active:bg-rose-voile"
              >
                {n}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
