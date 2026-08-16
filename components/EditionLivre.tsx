"use client";

import { useMemo, useState } from "react";

import { Bouton } from "@/components/ui/Bouton";
import { Champ, Segments, Selecteur, ZoneTexte } from "@/components/ui/Champ";
// Le statut ne se change pas ici : il ouvre ou clôt une lecture, et vit donc
// avec les pastilles de la fiche, pas dans un formulaire de métadonnées.
import { Feuille } from "@/components/ui/Feuille";
import { envoyer } from "@/lib/client-api";
import { GENRES } from "@/lib/genres";

type Livre = {
  id: number;
  titre: string;
  auteur: string;
  isbn13: string | null;
  pages: number | null;
  dureeMinutes: number | null;
  format: "papier" | "ebook" | "audio" | null;
  genre: string | null;
  sousGenre: string | null;
  serieNom: string | null;
  tome: number | null;
  synopsis: string | null;
  resume: string | null;
  prix: number | null;
  dateSortie: string | null;
};

const texte = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

/**
 * Édition de toutes les métadonnées d'un livre.
 *
 * Les catalogues se trompent, sont incomplets, ou décrivent une autre
 * édition que celle qu'on tient : rien de ce qu'ils fournissent ne doit
 * rester figé. La note et le ressenti vivent à part, dans FeuilleNotation.
 */
export function EditionLivre({
  livre,
  ouverte,
  onFermer,
  onEnregistre,
}: {
  livre: Livre;
  ouverte: boolean;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const [v, setV] = useState({
    titre: livre.titre,
    auteur: livre.auteur,
    isbn13: texte(livre.isbn13),
    pages: texte(livre.pages),
    dureeMinutes: texte(livre.dureeMinutes),
    format: livre.format ?? "papier",
    genre: texte(livre.genre),
    sousGenre: texte(livre.sousGenre),
    serie: texte(livre.serieNom),
    tome: texte(livre.tome),
    synopsis: texte(livre.synopsis),
    resume: texte(livre.resume),
    prix: texte(livre.prix),
    dateSortie: texte(livre.dateSortie),
  });

  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const set = (c: keyof typeof v) => (val: string) =>
    setV((x) => ({ ...x, [c]: val }));

  const genresTries = useMemo(
    () => [...GENRES].sort((a, b) => a.libelle.localeCompare(b.libelle, "fr")),
    [],
  );

  async function enregistrer() {
    if (!v.titre.trim()) {
      setErreur("Le titre est obligatoire.");
      return;
    }

    setEnvoi(true);
    setErreur(null);

    const r = await envoyer({
      url: `/api/livres/${livre.id}`,
      methode: "PATCH",
      file: { table: "livres", operation: "modifier" },
      corps: {
        id: livre.id,
        titre: v.titre.trim(),
        auteur: v.auteur.trim() || "Auteur inconnu",
        // Chaîne vide → null, pour effacer un champ et non y écrire du vide.
        isbn13: v.isbn13.trim() || null,
        pages: v.pages || null,
        dureeMinutes: v.dureeMinutes || null,
        format: v.format,
        genre: v.genre || null,
        sousGenre: v.sousGenre.trim() || null,
        serie: v.serie.trim() || null,
        tome: v.tome || null,
        synopsis: v.synopsis.trim() || null,
        resume: v.resume.trim() || null,
        prix: v.prix || null,
        dateSortie: v.dateSortie || null,
      },
    });

    setEnvoi(false);

    if (r.statut === "erreur") {
      setErreur(r.message);
      return;
    }
    onFermer();
    onEnregistre();
  }

  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Modifier le livre"
      pied={
        <div className="flex gap-2">
          <Bouton variante="fantome" onClick={onFermer} disabled={envoi}>
            Annuler
          </Bouton>
          <Bouton className="flex-1" onClick={enregistrer} disabled={envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </Bouton>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <Champ
          label="Titre"
          value={v.titre}
          onChange={(e) => set("titre")(e.target.value)}
        />
        <Champ
          label="Auteur"
          value={v.auteur}
          onChange={(e) => set("auteur")(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Champ
            label="Série"
            value={v.serie}
            onChange={(e) => set("serie")(e.target.value)}
            placeholder="Les Sept Sœurs"
            aide="Vider pour détacher"
          />
          <Champ
            label="Tome"
            inputMode="decimal"
            value={v.tome}
            onChange={(e) => set("tome")(e.target.value)}
            placeholder="4"
            aide="2.5 accepté"
          />
        </div>

        <Segments
          label="Format"
          id="format-edition"
          valeur={v.format}
          onChange={(f) => setV((x) => ({ ...x, format: f }))}
          options={[
            { valeur: "papier", libelle: "Papier" },
            { valeur: "ebook", libelle: "Ebook" },
            { valeur: "audio", libelle: "Audio" },
          ]}
        />

        <div className="grid grid-cols-2 gap-3">
          <Champ
            label="Pages"
            inputMode="numeric"
            value={v.pages}
            onChange={(e) => set("pages")(e.target.value)}
            placeholder="512"
          />
          <Champ
            label="Durée (minutes)"
            inputMode="numeric"
            value={v.dureeMinutes}
            onChange={(e) => set("dureeMinutes")(e.target.value)}
            placeholder="740"
            aide="Pour l'audio"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Selecteur
            label="Genre"
            value={v.genre}
            onChange={(e) => set("genre")(e.target.value)}
          >
            <option value="">Sans genre</option>
            {genresTries.map((g) => (
              <option key={g.cle} value={g.libelle}>
                {g.libelle}
              </option>
            ))}
          </Selecteur>
          <Champ
            label="Sous-genre"
            value={v.sousGenre}
            onChange={(e) => set("sousGenre")(e.target.value)}
            placeholder="Thriller nordique"
          />
        </div>

        <ZoneTexte
          label="Synopsis"
          rows={5}
          value={v.synopsis}
          onChange={(e) => set("synopsis")(e.target.value)}
          placeholder="La quatrième de couverture."
          className="font-lecture leading-relaxed"
        />

        <ZoneTexte
          label="Résumé de l'intrigue"
          rows={6}
          value={v.resume}
          onChange={(e) => set("resume")(e.target.value)}
          placeholder="Ce qui se passe vraiment — pour retrouver le fil au tome suivant, deux ans plus tard."
          className="font-lecture leading-relaxed"
        />

        <div className="grid grid-cols-2 gap-3">
          <Champ
            label="ISBN"
            inputMode="numeric"
            value={v.isbn13}
            onChange={(e) => set("isbn13")(e.target.value)}
            placeholder="9782365593823"
          />
          <Champ
            label="Prix (€)"
            inputMode="decimal"
            value={v.prix}
            onChange={(e) => set("prix")(e.target.value)}
            placeholder="21.90"
          />
        </div>

        <Champ
          label="Date de sortie"
          type="date"
          value={v.dateSortie}
          onChange={(e) => set("dateSortie")(e.target.value)}
        />

        {erreur ? (
          <p className="rounded-tuile bg-[#FBE9ED] px-4 py-3 text-[13px] text-[#A8324A]">
            {erreur}
          </p>
        ) : null}
      </div>
    </Feuille>
  );
}
