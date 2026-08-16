"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChoixCouverture } from "@/components/ChoixCouverture";
import { Couverture } from "@/components/Couverture";
import { Bouton } from "@/components/ui/Bouton";
import {
  Champ,
  ChampSuggestions,
  Segments,
  Selecteur,
} from "@/components/ui/Champ";
import { IconeRecherche, IconeRetour } from "@/components/ui/Icones";
import { envoyer } from "@/lib/client-api";
import { GENRES, sousGenresDe } from "@/lib/genres";
import { envoyerCouverture, type CouverturePreparee } from "@/lib/image";
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
  sousGenre: string;
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
  sousGenre: "",
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
  const [sources, setSources] = useState<Record<string, string> | null>(null);
  const [toutesEnEchec, setToutesEnEchec] = useState(false);

  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [couverture, setCouverture] = useState<CouverturePreparee | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const annulation = useRef<AbortController | null>(null);

  /**
   * Le passage à l'étape formulaire empile une entrée d'historique.
   *
   * Sans ça, le geste de retour du navigateur quitte la page d'ajout et fait
   * perdre la recherche — alors que l'utilisateur voulait seulement revenir
   * à la liste des résultats. Sur mobile, c'est le geste qu'on fait en
   * premier, bien avant de chercher un bouton.
   */
  useEffect(() => {
    const retour = () => setBrouillon(null);
    window.addEventListener("popstate", retour);
    return () => window.removeEventListener("popstate", retour);
  }, []);

  function ouvrirFormulaire(depuis: Brouillon) {
    setBrouillon(depuis);
    setCouverture(null);
    setErreur(null);
    window.history.pushState({ etape: "formulaire" }, "");
  }

  /** Repasse par l'historique pour ne pas y laisser une entrée orpheline. */
  function revenirAuxResultats() {
    if (window.history.state?.etape === "formulaire") window.history.back();
    else setBrouillon(null);
  }

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
        setSources(data.sources ?? null);
        setToutesEnEchec(Boolean(data.toutesEnEchec));
      } catch (e) {
        // Une requête annulée par la frappe suivante n'est pas une panne :
        // laisser l'état d'échec ici afficherait une erreur à chaque lettre.
        if ((e as Error).name === "AbortError") return;
        setToutesEnEchec(true);
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

  const sousGenres = useMemo(
    () => sousGenresDe(brouillon?.genre),
    [brouillon?.genre],
  );

  function choisir(r: Resultat) {
    ouvrirFormulaire({
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
        sousGenre: brouillon.sousGenre.trim() || null,
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
      if (couverture) {
        setErreur(
          "Livre mis en attente — la couverture devra être ajoutée une fois reconnectée.",
        );
      }
      router.push("/bibliotheque");
      return;
    }

    const id = r.data.livre.id;

    // La couverture part après le livre : elle a besoin de son identifiant.
    // Un échec ici ne doit pas faire croire que l'ajout a raté — le livre
    // existe, il lui manque juste une image, qu'on remet depuis sa fiche.
    if (couverture) {
      try {
        await envoyerCouverture(id, couverture.blob);
      } catch (e) {
        console.error("Couverture non envoyée :", e);
      }
    }

    router.push(`/bibliotheque/${id}`);
    router.refresh();
  }

  /* ── Formulaire ─────────────────────────────────────────────────────── */
  if (brouillon) {
    const set = (champ: keyof Brouillon) => (v: string) =>
      setBrouillon((b) => (b ? { ...b, [champ]: v } : b));

    return (
      <div className="space-y-4 px-5 pt-1 pb-10">
        {/* Retour explicite en haut, en plus du geste système : sur desktop
            il n'y a pas de geste, et la flèche indique où l'on est. */}
        <button
          type="button"
          onClick={revenirAuxResultats}
          disabled={envoi}
          className="-ml-1.5 inline-flex min-h-[44px] items-center gap-1 text-[15px] font-medium text-encre-70"
        >
          <IconeRetour className="h-5 w-5" />
          {resultats.length > 0 ? "Résultats" : "Recherche"}
        </button>

        <ChoixCouverture
          titre={brouillon.titre}
          auteur={brouillon.auteur}
          genre={brouillon.genre}
          urlActuelle={brouillon.couvertureUrl || null}
          onChoisie={setCouverture}
          onRetiree={() => {
            setCouverture(null);
            set("couvertureUrl")("");
          }}
        />

        <div className="space-y-3">
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
            onChange={(e) => {
              // Changer de genre invalide le sous-genre précédent : « Space
              // opera » n'a plus de sens une fois passé en « Biographie ».
              setBrouillon((b) =>
                b ? { ...b, genre: e.target.value, sousGenre: "" } : b,
              );
            }}
          >
            <option value="">Sans genre</option>
            {genresTries.map((g) => (
              <option key={g.cle} value={g.libelle}>
                {g.libelle}
              </option>
            ))}
          </Selecteur>
        </div>

        <ChampSuggestions
          id="sous-genre-ajout"
          label="Sous-genre"
          value={brouillon.sousGenre}
          onChange={(e) => set("sousGenre")(e.target.value)}
          suggestions={sousGenres}
          placeholder={sousGenres[0] ?? "Facultatif"}
          aide={
            brouillon.genre
              ? "Suggestions selon le genre, saisie libre acceptée"
              : "Choisis un genre pour voir des suggestions"
          }
        />

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
            onClick={revenirAuxResultats}
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

      {/* Les deux catalogues injoignables : c'est une panne, pas une absence.
          On le dit franchement, et on pousse vers la saisie manuelle. */}
      {toutesEnEchec && !cherche ? (
        <div className="mt-3 rounded-carte bg-[#FDF3E3] px-4 py-3 text-[13px] leading-relaxed text-[#7A5310]">
          Aucun des deux catalogues ne répond. Ce n&apos;est pas ta connexion —
          réessaie plus tard, ou saisis le livre à la main, c&apos;est immédiat.
        </div>
      ) : null}

      {/* Une seule source tombée : les résultats de l'autre s'affichent
          quand même, on signale juste que la liste est partielle. */}
      {!toutesEnEchec && !cherche && sources?.openlibrary === "echec" ? (
        <p className="mt-3 text-[12px] text-encre-45">
          Open Library ne répond pas — résultats de la BnF uniquement, sans
          couverture ni pagination.
        </p>
      ) : null}
      {!toutesEnEchec && !cherche && sources?.bnf === "echec" ? (
        <p className="mt-3 text-[12px] text-encre-45">
          La BnF ne répond pas — résultats d&apos;Open Library uniquement, dont
          le catalogue français est incomplet.
        </p>
      ) : null}

      {cherche ? (
        <ul className="mt-4 space-y-3">
          {/* Squelette plutôt qu'un « Recherche… » : on interroge deux
              catalogues, l'attente peut atteindre quelques secondes. */}
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="squelette h-[66px] w-11 shrink-0 rounded-[8px]" />
              <div className="flex-1 space-y-2">
                <div className="squelette h-3.5 w-3/4 rounded-pilule" />
                <div className="squelette h-3 w-1/2 rounded-pilule" />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="mt-3 divide-y divide-bordure">
        {resultats.map((r) => (
          <li key={r.cle}>
            <button
              type="button"
              onClick={() => choisir(r)}
              className="flex w-full items-center gap-3 py-3 text-left transition-colors active:bg-rose-voile"
            >
              <Couverture
                titre={r.titre}
                auteur={r.auteur}
                url={r.couvertureUrl}
                genre={r.genre}
                className="h-[68px] w-[46px] shrink-0"
                sizes="46px"
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
                <p className="mt-1 flex items-center gap-1.5">
                  <span className="rounded-pilule bg-rose-voile px-1.5 py-0.5 text-[10px] font-semibold text-rose-fonce ring-1 ring-rose-poudre">
                    {r.source === "bnf" ? "BnF" : "Open Library"}
                  </span>
                  {r.pages ? (
                    <span className="chiffres text-[10.5px] text-encre-45">
                      {r.pages} p.
                    </span>
                  ) : (
                    <span className="text-[10.5px] text-encre-45">
                      pages à compléter
                    </span>
                  )}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {!cherche &&
      !toutesEnEchec &&
      requete.trim().length >= 2 &&
      resultats.length === 0 ? (
        <p className="mt-4 text-[13px] leading-relaxed text-encre-45">
          Aucun des deux catalogues ne connaît ce titre. C&apos;est fréquent
          pour les parutions récentes et les petits éditeurs — la saisie
          manuelle est la bonne réponse.
        </p>
      ) : null}

      <div className="mt-6 border-t border-bordure pt-4">
        <Bouton
          variante={resultats.length === 0 ? "principal" : "doux"}
          taille="lg"
          onClick={() => ouvrirFormulaire({ ...VIDE, titre: requete.trim() })}
        >
          Saisir à la main
        </Bouton>
      </div>
    </div>
  );
}
