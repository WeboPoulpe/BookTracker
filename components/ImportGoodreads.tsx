"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Bouton } from "@/components/ui/Bouton";
import { analyserCsv, NOM_FORMAT, type Analyse } from "@/lib/import-csv";
import { LIBELLE_STATUT, nombre, pluriel } from "@/lib/format";

type Etape = "attente" | "apercu" | "envoi" | "fini";

const TAILLE_LOT = 100;

export function ImportGoodreads() {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);

  const [etape, setEtape] = useState<Etape>("attente");
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [avancement, setAvancement] = useState(0);
  const [bilan, setBilan] = useState({
    crees: 0,
    completes: 0,
    inchanges: 0,
    lecturesAjoutees: 0,
    echecs: 0,
  });
  const [couvertures, setCouvertures] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function choisirFichier(fichier: File) {
    setErreur(null);
    try {
      const texte = await fichier.text();
      const a = analyserCsv(texte);

      if (a.format === "inconnu") {
        setErreur(
          "Format non reconnu. Attendu : un export Goodreads ou StoryGraph.",
        );
        return;
      }

      if (a.livres.length === 0) {
        setErreur(
          a.colonnesManquantes.length
            ? `Colonnes absentes du fichier : ${a.colonnesManquantes.join(", ")}.`
            : "Aucune ligne exploitable dans ce fichier.",
        );
        return;
      }

      setAnalyse(a);
      setEtape("apercu");
    } catch {
      setErreur("Fichier illisible.");
    }
  }

  async function lancer() {
    if (!analyse) return;

    setEtape("envoi");
    setAvancement(0);
    const cumul = {
      crees: 0,
      completes: 0,
      inchanges: 0,
      lecturesAjoutees: 0,
      echecs: 0,
    };

    for (let i = 0; i < analyse.livres.length; i += TAILLE_LOT) {
      const lot = analyse.livres.slice(i, i + TAILLE_LOT);

      try {
        const r = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lot }),
        });
        const data = await r.json();

        if (!r.ok) {
          setErreur(data?.erreur?.message ?? "Import interrompu.");
          break;
        }

        cumul.crees += data.crees;
        cumul.completes += data.completes;
        cumul.inchanges += data.inchanges;
        cumul.lecturesAjoutees += data.lecturesAjoutees;
        cumul.echecs += data.echecs?.length ?? 0;
      } catch {
        setErreur("Réseau interrompu pendant l'import.");
        break;
      }

      setAvancement(Math.min(i + TAILLE_LOT, analyse.livres.length));
      setBilan({ ...cumul });
    }

    setBilan(cumul);
    setEtape("fini");
    router.refresh();
  }

  async function recupererCouvertures() {
    setCouvertures("Recherche des couvertures…");

    let trouves = 0;
    let substituts = 0;
    let examines = 0;
    let restants = 0;
    let curseur = 0;

    try {
      // Vagues enchaînées automatiquement : demander à l'utilisatrice de
      // relancer autant de fois qu'il y a de lots, c'est lui faire faire le
      // travail de la boucle.
      for (let vague = 0; vague < 40; vague += 1) {
        const r = await fetch(`/api/import?apres=${curseur}`, {
          method: "PATCH",
        });
        const d = await r.json();
        if (!r.ok) throw new Error("interrompu");
        if (d.traites === 0) break;

        trouves += d.trouves;
        substituts += d.substituts ?? 0;
        examines += d.traites;
        restants = d.restants;
        curseur = d.curseur;

        setCouvertures(
          `${pluriel(trouves, "couverture trouvée", "couvertures trouvées")} sur ${nombre(examines)} livres examinés…`,
        );
      }

      setCouvertures(
        `${pluriel(trouves, "couverture trouvée", "couvertures trouvées")} sur ${nombre(examines)} livres examinés` +
          (substituts > 0
            ? `, ${nombre(substituts)} image(s) générique(s) écartée(s)`
            : "") +
          `. ${
            restants > 0
              ? `${nombre(restants)} livres restent sans image : les catalogues ne l'ont pas. Tu peux la choisir à la main sur la fiche.`
              : "Terminé."
          }`,
      );
      router.refresh();
    } catch {
      setCouvertures("Récupération impossible pour le moment.");
    }
  }

  /* ── Bilan ──────────────────────────────────────────────────────────── */
  if (etape === "fini") {
    return (
      <div className="px-5 pt-4 pb-10">
        <div className="carte p-5">
          <p className="font-display text-xl font-semibold">Import terminé</p>
          <dl className="chiffres mt-4 space-y-2 text-[15px]">
            <div className="flex justify-between">
              <dt className="text-encre-70">Livres ajoutés</dt>
              <dd className="font-semibold">{nombre(bilan.crees)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-encre-70">Livres complétés</dt>
              <dd className="font-semibold">{nombre(bilan.completes)}</dd>
            </div>
            {bilan.lecturesAjoutees > 0 ? (
              <div className="flex justify-between">
                <dt className="text-encre-70">Lectures ajoutées</dt>
                <dd>{nombre(bilan.lecturesAjoutees)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-encre-70">Déjà complets, inchangés</dt>
              <dd>{nombre(bilan.inchanges)}</dd>
            </div>
            {bilan.echecs > 0 ? (
              <div className="flex justify-between text-[#A8324A]">
                <dt>En échec</dt>
                <dd>{nombre(bilan.echecs)}</dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-3 text-[12.5px] leading-relaxed text-encre-45">
            Aucun champ déjà rempli n&apos;a été écrasé : seuls les champs
            vides ont été complétés.
          </p>
        </div>

        <div className="mt-4 carte p-5">
          <p className="text-[15px] font-medium">Couvertures</p>
          <p className="mt-1 text-[13px] leading-relaxed text-encre-45">
            Aucun export n&apos;en contient. On les cherche par ISBN chez Open
            Library puis Google Books, par vagues, en écartant les vignettes
            génériques que ces catalogues servent quand ils ne connaissent pas
            le livre.
          </p>
          {couvertures ? (
            <p className="mt-3 text-[13px] text-encre-70">{couvertures}</p>
          ) : null}
          <div className="mt-3">
            <Bouton variante="doux" taille="sm" onClick={recupererCouvertures}>
              Récupérer les couvertures
            </Bouton>
          </div>
        </div>

        <div className="mt-4">
          <Bouton taille="lg" onClick={() => router.push("/bibliotheque")}>
            Voir ma bibliothèque
          </Bouton>
        </div>
      </div>
    );
  }

  /* ── Envoi ──────────────────────────────────────────────────────────── */
  if (etape === "envoi" && analyse) {
    const ratio = avancement / analyse.livres.length;
    return (
      <div className="px-5 pt-8 pb-10">
        <p className="chiffres text-center font-display text-3xl font-semibold">
          {nombre(avancement)} / {nombre(analyse.livres.length)}
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-pilule bg-bordure">
          <div
            className="h-full rounded-pilule bg-sauge transition-[width] duration-300"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
        <p className="mt-3 text-center text-[13px] text-encre-45">
          Ne ferme pas cet écran.
        </p>
      </div>
    );
  }

  /* ── Aperçu ─────────────────────────────────────────────────────────── */
  if (etape === "apercu" && analyse) {
    const apercu = analyse.livres.slice(0, 20);
    return (
      <div className="px-5 pt-4 pb-10">
        <div className="carte p-4">
          <p className="text-[11.5px] font-bold tracking-[0.14em] text-rose-fonce uppercase">
            Export {NOM_FORMAT[analyse.format]}
          </p>
          <p className="chiffres mt-1 text-[15px]">
            <span className="font-semibold">
              {nombre(analyse.livres.length)}
            </span>{" "}
            livres lus dans le fichier
            {analyse.rejets.length > 0 ? (
              <>
                {" · "}
                <span className="text-[#A8324A]">
                  {nombre(analyse.rejets.length)} rejetés
                </span>
              </>
            ) : null}
          </p>

          {/* Les approximations sont annoncées avant confirmation, jamais
              découvertes après coup dans les statistiques. */}
          {analyse.datesApprochees > 0 ? (
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#7A5310]">
              {pluriel(analyse.datesApprochees, "livre lu")} sans date de
              lecture : leur date d&apos;ajout fera foi, sans quoi ils
              n&apos;apparaîtraient dans aucune statistique.
            </p>
          ) : null}

          {analyse.auteursMultiples > 0 ? (
            <p className="mt-2 text-[12.5px] leading-relaxed text-encre-45">
              {pluriel(analyse.auteursMultiples, "livre")} à plusieurs auteurs :
              le premier est retenu. StoryGraph place parfois la traductrice
              devant — à corriger sur la fiche.
            </p>
          ) : null}

          {analyse.colonnesManquantes.length > 0 ? (
            <p className="mt-2 text-[13px] text-[#7A5310]">
              Colonnes absentes, ces données ne remonteront pas :{" "}
              {analyse.colonnesManquantes.join(", ")}.
            </p>
          ) : null}
        </div>

        {analyse.rejets.length > 0 ? (
          <div className="mt-4">
            <h2 className="text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
              Lignes rejetées
            </h2>
            <ul className="mt-2 space-y-1">
              {analyse.rejets.slice(0, 10).map((r) => (
                <li key={r.ligne} className="text-[13px] text-encre-70">
                  <span className="chiffres text-encre-45">L{r.ligne}</span>{" "}
                  {r.titre} — {r.motif}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <h2 className="mt-5 text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
          Aperçu des 20 premières lignes
        </h2>
        <ul className="mt-2 divide-y divide-bordure">
          {apercu.map((l, i) => (
            <li key={i} className="py-2.5">
              <p className="font-lecture text-[15px] leading-snug">
                {l.titre}
                {l.serie ? (
                  <span className="text-encre-45">
                    {" "}
                    · {l.serie}
                    {l.tome != null ? ` #${l.tome}` : ""}
                  </span>
                ) : null}
              </p>
              <p className="chiffres mt-0.5 text-[12px] text-encre-45">
                {l.auteur} · {LIBELLE_STATUT[l.statut]}
                {l.pages ? ` · ${nombre(l.pages)} p.` : ""}
                {l.note ? ` · ${l.note}/5` : ""}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex gap-2">
          <Bouton
            variante="fantome"
            onClick={() => {
              setAnalyse(null);
              setEtape("attente");
            }}
          >
            Annuler
          </Bouton>
          <Bouton className="flex-1" onClick={lancer}>
            Importer {nombre(analyse.livres.length)} livres
          </Bouton>
        </div>
      </div>
    );
  }

  /* ── Attente ────────────────────────────────────────────────────────── */
  return (
    <div className="px-5 pt-4 pb-10">
      <div className="carte p-5">
        <p className="text-[15px] font-medium">Où trouver le fichier</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[13px] leading-relaxed text-encre-70">
          <li>
            Sur Goodreads, ouvre <em>My Books</em> → <em>Import and export</em>.
          </li>
          <li>
            Clique <em>Export Library</em>, puis attends le lien de
            téléchargement.
          </li>
          <li>Reviens ici et sélectionne le CSV.</li>
        </ol>
      </div>

      <input
        ref={champ}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) choisirFichier(f);
        }}
      />

      <div className="mt-4">
        <Bouton taille="lg" onClick={() => champ.current?.click()}>
          Choisir un fichier CSV
        </Bouton>
      </div>

      {erreur ? (
        <p className="mt-3 rounded-carte bg-[#FBE9ED] px-3.5 py-2.5 text-[13px] text-[#A8324A]">
          {erreur}
        </p>
      ) : null}

      <p className="mt-4 text-[13px] leading-relaxed text-encre-45">
        Rien n&apos;est envoyé avant ta confirmation : le fichier est analysé
        dans le navigateur, et tu vois d&apos;abord ce qui va être importé.
      </p>
    </div>
  );
}
