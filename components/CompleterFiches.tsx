"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Bouton } from "@/components/ui/Bouton";
import { nombre, pluriel } from "@/lib/format";

/** Fiche que les catalogues n'ont pas su compléter — à saisir à la main. */
type Incomplete = {
  id: number;
  titre: string;
  auteur: string;
  sansCouverture: boolean;
  sansSynopsis: boolean;
  sansGenre: boolean;
};

/**
 * Complètement des fiches, à la demande, depuis les réglages.
 *
 * Elle vivait uniquement au bout du tunnel d'import, donc inatteignable une
 * fois l'import terminé — or c'est précisément après coup qu'on constate les
 * manques. Et la réponse dépend du réseau de la machine : un poste dont le
 * pare-feu coupe un catalogue ne trouvera rien là où le serveur trouvera
 * beaucoup. L'action doit donc être rejouable depuis l'app déployée.
 *
 * Couverture et synopsis voyagent ensemble parce qu'ils viennent de la même
 * fiche : deux boutons auraient interrogé le catalogue deux fois pour un
 * livre à qui il manque les deux.
 */
export function CompleterFiches({
  sansCouverture,
  sansSynopsis,
  sansGenre,
  total,
}: {
  sansCouverture: number;
  sansSynopsis: number;
  sansGenre: number;
  /** Livres à qui il manque au moins l'un des trois — le travail à mener */
  total: number;
}) {
  const router = useRouter();
  const [encours, setEncours] = useState(false);
  const [bilan, setBilan] = useState<string | null>(null);
  const [restantes, setRestantes] = useState<Incomplete[]>([]);
  // Point de reprise après une interruption : sans lui, un nouvel essai
  // réexaminerait d'abord tous les livres que le premier n'a pas su
  // compléter, et n'atteindrait jamais la suite.
  const [reprise, setReprise] = useState(0);

  async function lancer() {
    setEncours(true);
    setBilan("Recherche en cours…");

    let trouves = 0;
    let synopsis = 0;
    let genres = 0;
    let substituts = 0;
    let restants = total;
    let curseur = reprise;
    let examines = 0;

    try {
      // Vagues successives, chacune reprenant au curseur rendu par la
      // précédente : une vague qui ne trouve rien ne doit pas empêcher
      // d'atteindre les livres suivants. On s'arrête quand la vague revient
      // vide, c'est-à-dire à la fin de la bibliothèque.
      for (let vague = 0; vague < 40; vague += 1) {
        const r = await fetch(`/api/import?apres=${curseur}`, {
          method: "PATCH",
        });
        if (!r.ok) throw new Error("interrompu");
        const d = await r.json();

        // Relevée à chaque tour, y compris au tour final qui ne traite rien :
        // c'est la dernière qui dit l'état réel une fois la passe achevée.
        setRestantes(d.incompletes ?? []);

        if (d.traites === 0) break;

        trouves += d.trouves;
        synopsis += d.synopsis ?? 0;
        genres += d.genres ?? 0;
        substituts += d.substituts ?? 0;
        restants = d.restants;
        curseur = d.curseur;
        examines += d.traites;

        setBilan(
          `${nombre(trouves)} couverture(s), ${nombre(synopsis)} synopsis, ${nombre(genres)} genre(s) sur ${nombre(examines)} livres examinés…`,
        );
      }

      // Passe terminée : le prochain essai repart du début, pour retenter les
      // livres qu'un catalogue momentanément muet avait laissés de côté.
      setReprise(0);
      setBilan(
        acquis(trouves, synopsis, genres) +
          (substituts > 0
            ? `, ${nombre(substituts)} image(s) générique(s) écartée(s)`
            : "") +
          (restants > 0
            ? `. ${nombre(restants)} fiche(s) restent incomplètes — les catalogues n'ont pas su les compléter :`
            : ". Toutes les fiches sont complètes."),
      );
      router.refresh();
    } catch {
      setReprise(curseur);
      // Ce que les vagues déjà passées ont trouvé est enregistré : annoncer
      // un échec sec le ferait croire perdu, et relancer semblerait repartir
      // de zéro. On dit donc ce qui est acquis.
      setBilan(
        (trouves > 0 || synopsis > 0 || genres > 0
          ? `${acquis(trouves, synopsis, genres)} avant l'interruption. `
          : "") +
          "La recherche s'est arrêtée en chemin — relance pour reprendre là où elle en était.",
      );
      router.refresh();
    } finally {
      setEncours(false);
    }
  }

  return (
    <div className="px-4 py-3">
      <p className="text-[15px] font-medium">Compléter les fiches</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-encre-45">
        {total === 0
          ? "Toutes tes fiches ont image, synopsis et genre."
          : `${detail(sansCouverture, sansSynopsis, sansGenre)} On cherche chez Apple Books par titre et auteur, puis par ISBN chez Open Library et Google Books ; les vignettes génériques sont écartées. Rien de ce que tu as déjà écrit n'est touché.`}
      </p>

      {bilan ? (
        <p className="mt-2 text-[13px] leading-relaxed text-encre-70">{bilan}</p>
      ) : null}

      {/* Nommer les fiches restantes, et non les compter seulement : un
          nombre indique qu'il y a du travail, un lien permet de le faire.
          Chaque ligne dit aussi ce qui manque, pour ouvrir la fiche en
          sachant quoi y saisir. */}
      {restantes.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {restantes.map((f) => (
            <li key={f.id}>
              <Link
                href={`/bibliotheque/${f.id}`}
                className="flex items-baseline justify-between gap-3 active:text-encre"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-encre-70">
                  {f.titre}
                  <span className="text-encre-45"> · {f.auteur}</span>
                </span>
                <span className="shrink-0 text-[11.5px] text-rose-fonce">
                  {manques(f)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {total > 0 ? (
        <div className="mt-3">
          <Bouton
            variante="doux"
            taille="sm"
            disabled={encours}
            onClick={lancer}
          >
            {encours ? "Recherche…" : "Compléter les fiches"}
          </Bouton>
        </div>
      ) : null}
    </div>
  );
}

/** « image, genre » — ce qu'il reste à saisir sur cette fiche. */
function manques(f: Incomplete): string {
  return [
    f.sansCouverture ? "image" : null,
    f.sansSynopsis ? "synopsis" : null,
    f.sansGenre ? "genre" : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** « 3 couvertures, 12 synopsis ajoutés », en taisant ce qui vaut zéro. */
function acquis(couvertures: number, synopsis: number, genres: number): string {
  const bouts = [
    couvertures > 0
      ? pluriel(couvertures, "couverture ajoutée", "couvertures ajoutées")
      : null,
    synopsis > 0
      ? pluriel(synopsis, "synopsis ajouté", "synopsis ajoutés")
      : null,
    genres > 0 ? pluriel(genres, "genre ajouté", "genres ajoutés") : null,
  ].filter(Boolean);

  return bouts.length ? bouts.join(", ") : "Aucun complément trouvé";
}

/** Ce qui manque, en ne nommant que ce qui manque vraiment. */
function detail(
  sansCouverture: number,
  sansSynopsis: number,
  sansGenre: number,
): string {
  const bouts = [
    sansCouverture > 0 ? `${pluriel(sansCouverture, "livre")} sans image` : null,
    sansSynopsis > 0 ? `${nombre(sansSynopsis)} sans synopsis` : null,
    sansGenre > 0 ? `${nombre(sansGenre)} sans genre` : null,
  ].filter(Boolean);

  return `${bouts.join(", ")}.`;
}
