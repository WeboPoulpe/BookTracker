"use client";

import { useMemo, useState } from "react";

import { Champ, Selecteur } from "@/components/ui/Champ";
import { sousGenresDe } from "@/lib/genres";

const AUTRE = "__autre__";

/**
 * Liste déroulante de sous-genres, filtrée par le genre choisi.
 *
 * Sans genre, il n'y a rien de pertinent à proposer : le champ reste
 * désactivé plutôt que d'offrir cent-douze entrées sans rapport.
 *
 * L'option « Autre » ouvre une saisie libre. Une liste strictement fermée
 * finirait par refuser le livre qu'on tient en main — c'est le reproche
 * central fait aux tableurs du marché (§1).
 */
export function SelecteurSousGenre({
  genre,
  valeur,
  onChange,
  id = "sous-genre",
}: {
  genre: string;
  valeur: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  const suggestions = useMemo(() => sousGenresDe(genre), [genre]);

  // Une valeur venue d'un import ou d'une saisie libre antérieure n'est pas
  // dans la liste : on l'y ajoute au lieu de la faire disparaître du menu,
  // ce qui reviendrait à l'effacer sans prévenir à la première ouverture.
  const horsListe = valeur !== "" && !suggestions.includes(valeur);
  const [libre, setLibre] = useState(false);

  const options = horsListe ? [valeur, ...suggestions] : suggestions;

  if (!genre) {
    return (
      <Selecteur label="Sous-genre" value="" disabled onChange={() => {}}>
        <option value="">Choisis d&apos;abord un genre</option>
      </Selecteur>
    );
  }

  if (libre) {
    return (
      <Champ
        label="Sous-genre"
        autoFocus
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!valeur.trim()) setLibre(false);
        }}
        placeholder="Ton sous-genre"
        aide="Saisie libre — laisse vide pour revenir à la liste"
      />
    );
  }

  return (
    <Selecteur
      label="Sous-genre"
      id={id}
      value={valeur}
      onChange={(e) => {
        if (e.target.value === AUTRE) {
          onChange("");
          setLibre(true);
          return;
        }
        onChange(e.target.value);
      }}
    >
      <option value="">Aucun — classé par genre</option>
      {options.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
      <option value={AUTRE}>Autre…</option>
    </Selecteur>
  );
}
