"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Couverture } from "@/components/Couverture";
import { Bouton } from "@/components/ui/Bouton";
import { Champ, Segments, Selecteur } from "@/components/ui/Champ";
import { IconeRecherche } from "@/components/ui/Icones";
import { envoyer } from "@/lib/client-api";
import { GENRES } from "@/lib/genres";
import type { Resultat } from "@/lib/openlibrary";
import { STATUTS } from "@/lib/validation";
import { LIBELLE_STATUT } from "@/lib/format";

type Brouillon = {
  titre: string;
  auteur: string;
  isbn13: string;
  couvertureUrl: string;
  pages: string;
  genre: string;
  serie: string;
  tome: string;
  format: "papier" | "ebook" | "audio";
  statut: (typeof STATUTS)[number];
};

const VIDE: Brouillon = {
  titre: "",
  auteur: "",
  isbn13: "",
  couvertureUrl: "",
  pages: "",
  genre: "",
  serie: "",
  tome: "",
  format: "papier",
  statut: "a_lire",
};

export function AjoutLivre() {
  const router = useRouter();

  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [cherche, setCherche] = useState(false);
  const [indisponible, setIndisponible] = useState(false);

  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const annulation = useRef<AbortController | null>(null);

  // Anti-rebond : sans lui, chaque frappe part chez Open Library
  useEffect(() => {
    const q = requete.trim();
    if (q.length < 2) {
      setResultats([]);
      setCherche(false);
      return;
    }

    setCherche(true);
    const minuteur = setTimeout(async () => {
      annulation.current?.abort();
      const ctrl = new AbortController();
      annulation.current = ctrl;

      try {
        const r = await fetch(`/api/recherche-livre?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = await r.json();
        setResultats(data.resultats ?? []);
        setIndisponible(Boolean(data.indisponible));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setIndisponible(true);
      } finally {
        setCherche(false);
      }
    }, 350);

    return () => clearTimeout(minuteur);
  }, [requete]);

  const genresTries = useMemo(
    () => [...GENRES].sort((a, b) => a.libelle.localeCompare(b.libelle, "fr")),
    [],
  );

  function choisir(r: Resultat) {
    setBrouillon({
      ...VIDE,
      titre: r.titre,
      auteur: r.auteur,
      isbn13: r.isbn13 ?? "",
      couvertureUrl: r.couvertureUrl ?? "",
      pages: r.pages ? String(r.pages) : "",
      genre: r.genre ?? "",
      serie: r.serie ?? "",
      tome: r.tome != null ? String(r.tome) : "",
    });
    setErreur(null);
  }

  async function enregistrer() {
    if (!brouillon?.titre.trim()) {
      setErreur("Le titre est obligatoire.");
      return;
    }

    setEnvoi(true);
    setErreur(null);

    const r = await envoyer<{ livre: { id: number } }>({
      url: "/api/livres",
      methode: "POST",
      file: { table: "livres", operation: "creer" },
      corps: {
        ...brouillon,
        auteur: brouillon.auteur.trim() || "Auteur inconnu",
        pages: brouillon.pages || null,
        tome: brouillon.tome || null,
        isbn13: brouillon.isbn13 || null,
        couvertureUrl: brouillon.couvertureUrl || null,
        genre: brouillon.genre || null,
        serie: brouillon.serie || null,
      },
    });

    setEnvoi(false);

    if (r.statut === "erreur") {
      setErreur(r.message);
      return;
    }

    if (r.statut === "en_file") {
      // Le livre n'a pas encore d'identifiant : il n'existera qu'à la
      // reprise. On renvoie vers la bibliothèque plutôt que vers une fiche
      // qui n'existe pas.
      router.push("/bibliotheque");
      return;
    }

    router.push(`/bibliotheque/${r.data.livre.id}`);
    router.refresh();
  }

  /* ── Formulaire ─────────────────────────────────────────────────────── */
  if (brouillon) {
    const set = (champ: keyof Brouillon) => (v: string) =>
      setBrouillon((b) => (b ? { ...b, [champ]: v } : b));

    return (
      <div className="space-y-4 px-5 pt-4 pb-10">
        <div className="flex gap-3">
          <Couverture
            titre={brouillon.titre || "Sans titre"}
            auteur={brouillon.auteur}
            url={brouillon.couvertureUrl || null}
            genre={brouillon.genre}
            className="h-32 w-[86px] shrink-0"
            sizes="86px"
          />
          <div className="min-w-0 flex-1 space-y-3">
            <Champ
              label="Titre"
              value={brouillon.titre}
              onChange={(e) => set("titre")(e.target.value)}
              placeholder="Le Palais des vents"
            />
            <Champ
              label="Auteur"
              value={brouillon.auteur}
              onChange={(e) => set("auteur")(e.target.value)}
              placeholder="Lucinda Riley"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Champ
            label="Série"
            value={brouillon.serie}
            onChange={(e) => set("serie")(e.target.value)}
            placeholder="Les Sept Sœurs"
          />
          <Champ
            label="Tome"
            inputMode="decimal"
            value={brouillon.tome}
            onChange={(e) => set("tome")(e.target.value)}
            placeholder="4"
            aide="2.5 accepté"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Champ
            label="Pages"
            inputMode="numeric"
            value={brouillon.pages}
            onChange={(e) => set("pages")(e.target.value)}
            placeholder="512"
          />
          <Selecteur
            label="Genre"
            value={brouillon.genre}
            onChange={(e) => set("genre")(e.target.value)}
          >
            <option value="">Sans genre</option>
            {genresTries.map((g) => (
              <option key={g.cle} value={g.libelle}>
                {g.libelle}
              </option>
            ))}
          </Selecteur>
        </div>

        <Segments
          label="Format"
          valeur={brouillon.format}
          onChange={(v) => setBrouillon((b) => (b ? { ...b, format: v } : b))}
          options={[
            { valeur: "papier", libelle: "Papier" },
            { valeur: "ebook", libelle: "Ebook" },
            { valeur: "audio", libelle: "Audio" },
          ]}
        />

        <Selecteur
          label="Statut"
          value={brouillon.statut}
          onChange={(e) =>
            setBrouillon((b) =>
              b ? { ...b, statut: e.target.value as Brouillon["statut"] } : b,
            )
          }
        >
          {STATUTS.map((s) => (
            <option key={s} value={s}>
              {LIBELLE_STATUT[s]}
            </option>
          ))}
        </Selecteur>

        {erreur ? (
          <p className="rounded-carte bg-[#FBE9ED] px-3.5 py-2.5 text-[13px] text-[#A8324A]">
            {erreur}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          <Bouton
            variante="fantome"
            onClick={() => setBrouillon(null)}
            disabled={envoi}
          >
            Retour
          </Bouton>
          <Bouton
            className="flex-1"
            onClick={enregistrer}
            disabled={envoi}
          >
            {envoi ? "Enregistrement…" : "Ajouter à ma bibliothèque"}
          </Bouton>
        </div>
      </div>
    );
  }

  /* ── Recherche ──────────────────────────────────────────────────────── */
  return (
    <div className="px-5 pt-4 pb-10">
      <div className="relative">
        <IconeRecherche className="pointer-events-none absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-encre-45" />
        <input
          autoFocus
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder="Titre, auteur ou ISBN"
          enterKeyHint="search"
          className="w-full rounded-pilule bg-white/85 py-3.5 pr-4 pl-10 ring-1 ring-rose-poudre outline-none backdrop-blur-sm focus:ring-2 focus:ring-dragee"
        />
      </div>

      {indisponible ? (
        <p className="mt-3 rounded-carte bg-[#FDF3E3] px-3.5 py-2.5 text-[13px] text-[#7A5310]">
          Open Library ne répond pas. La saisie manuelle reste disponible.
        </p>
      ) : null}

      {cherche ? (
        <p className="mt-4 text-[13px] text-encre-45">Recherche…</p>
      ) : null}

      <ul className="mt-3 divide-y divide-bordure">
        {resultats.map((r) => (
          <li key={r.cle}>
            <button
              type="button"
              onClick={() => choisir(r)}
              className="flex w-full items-center gap-3 py-2.5 text-left active:bg-encre/4"
            >
              <Couverture
                titre={r.titre}
                auteur={r.auteur}
                url={r.couvertureUrl}
                genre={r.genre}
                className="h-[66px] w-11 shrink-0"
                sizes="44px"
              />
              <div className="min-w-0 flex-1">
                <p className="font-lecture text-[15px] leading-snug line-clamp-2">
                  {r.titre}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-encre-45">
                  {r.auteur}
                  {r.annee ? ` · ${r.annee}` : ""}
                  {r.serie ? ` · ${r.serie}` : ""}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {!cherche && requete.trim().length >= 2 && resultats.length === 0 ? (
        <p className="mt-4 text-[13px] text-encre-45">
          Aucun résultat. Le catalogue francophone d&apos;Open Library est
          incomplet — la saisie manuelle est souvent la bonne réponse.
        </p>
      ) : null}

      <div className="mt-6 border-t border-bordure pt-4">
        <Bouton
          variante="doux"
          taille="lg"
          onClick={() => setBrouillon({ ...VIDE, titre: requete.trim() })}
        >
          Saisir à la main
        </Bouton>
      </div>
    </div>
  );
}
