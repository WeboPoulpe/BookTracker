"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Bouton } from "@/components/ui/Bouton";
import type { Appariement } from "@/db/requetes/kindle";
import { analyserClippings, dedoublonner, type AnalyseKindle } from "@/lib/kindle";
import { nombre, pluriel } from "@/lib/format";

type Etape = "attente" | "apercu" | "envoi" | "fini";

export function ImportKindle() {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);

  const [etape, setEtape] = useState<Etape>("attente");
  const [analyse, setAnalyse] = useState<AnalyseKindle | null>(null);
  const [appariements, setAppariements] = useState<Appariement[]>([]);
  const [exclus, setExclus] = useState<Set<string>>(new Set());
  const [bilan, setBilan] = useState({ crees: 0, ignores: 0, sansLivre: 0 });
  const [erreur, setErreur] = useState<string | null>(null);

  async function choisirFichier(fichier: File) {
    setErreur(null);
    try {
      const texte = await fichier.text();
      const a = analyserClippings(texte);

      if (a.surlignages.length === 0) {
        setErreur(
          a.total > 0
            ? "Ce fichier ne contient que des signets, sans texte à importer."
            : "Aucun surlignage trouvé. Est-ce bien le fichier My Clippings.txt de la liseuse ?",
        );
        return;
      }

      // Dédoublonnage avant appariement : inutile de faire voyager trois
      // versions du même passage jusqu'au serveur.
      const propres = dedoublonner(a.surlignages);
      setAnalyse({ ...a, surlignages: propres });

      const r = await fetch("/api/import-kindle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apparier", surlignages: propres }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErreur(data?.erreur?.message ?? "Rapprochement impossible.");
        return;
      }

      setAppariements(data.appariements ?? []);
      setEtape("apercu");
    } catch {
      setErreur("Fichier illisible.");
    }
  }

  async function lancer() {
    const retenus = appariements.filter(
      (a) => a.livreId !== null && !exclus.has(a.titreKindle),
    );
    if (retenus.length === 0) return;

    setEtape("envoi");
    try {
      const r = await fetch("/api/import-kindle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "importer",
          appariements: retenus.map((a) => ({
            livreId: a.livreId,
            surlignages: a.surlignages,
          })),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErreur(data?.erreur?.message ?? "Import interrompu.");
        setEtape("apercu");
        return;
      }
      setBilan(data);
      setEtape("fini");
      router.refresh();
    } catch {
      setErreur("Réseau interrompu pendant l'import.");
      setEtape("apercu");
    }
  }

  const trouves = appariements.filter((a) => a.livreId !== null);
  const orphelins = appariements.filter((a) => a.livreId === null);
  const retenusCount = trouves
    .filter((a) => !exclus.has(a.titreKindle))
    .reduce((s, a) => s + a.surlignages.length, 0);

  /* ── Bilan ──────────────────────────────────────────────────────────── */
  if (etape === "fini") {
    return (
      <div className="px-5 pt-4 pb-10">
        <div className="carte p-5">
          <p className="font-display text-xl font-semibold">Import terminé</p>
          <dl className="chiffres mt-4 space-y-2 text-[15px]">
            <div className="flex justify-between">
              <dt className="text-encre-70">Citations ajoutées</dt>
              <dd className="font-semibold">{nombre(bilan.crees)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-encre-70">Déjà présentes, ignorées</dt>
              <dd>{nombre(bilan.ignores)}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-4">
          <Bouton taille="lg" onClick={() => router.push("/citations")}>
            Voir mes citations
          </Bouton>
        </div>
      </div>
    );
  }

  if (etape === "envoi") {
    return (
      <div className="px-5 pt-10 pb-10 text-center">
        <p className="font-display text-2xl font-semibold">Import en cours…</p>
        <p className="mt-2 text-[13px] text-encre-45">Ne ferme pas cet écran.</p>
      </div>
    );
  }

  /* ── Aperçu ─────────────────────────────────────────────────────────── */
  if (etape === "apercu" && analyse) {
    return (
      <div className="px-5 pt-4 pb-10">
        <div className="carte p-4">
          <p className="chiffres text-[15px]">
            <span className="font-semibold">
              {nombre(analyse.surlignages.length)}
            </span>{" "}
            surlignages sur {pluriel(analyse.livres.length, "livre")}
          </p>
          <p className="mt-1 text-[12.5px] text-encre-45">
            {pluriel(trouves.length, "livre reconnu", "livres reconnus")} dans ta
            bibliothèque
            {orphelins.length > 0
              ? ` · ${nombre(orphelins.length)} sans correspondance`
              : ""}
          </p>
        </div>

        {trouves.length > 0 ? (
          <>
            <h2 className="mt-5 text-[11.5px] font-bold tracking-[0.14em] text-rose-fonce uppercase">
              À importer
            </h2>
            <ul className="mt-2 divide-y divide-bordure">
              {trouves.map((a) => {
                const exclu = exclus.has(a.titreKindle);
                return (
                  <li
                    key={a.titreKindle}
                    className="flex items-center gap-3 py-3"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExclus((s) => {
                          const n = new Set(s);
                          if (exclu) n.delete(a.titreKindle);
                          else n.add(a.titreKindle);
                          return n;
                        })
                      }
                      aria-pressed={!exclu}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[13px] font-bold ${
                        exclu
                          ? "bg-white text-transparent ring-1 ring-encre-20"
                          : "degrade-dragee text-rose-encre"
                      }`}
                    >
                      ✓
                    </button>
                    <div className={`min-w-0 flex-1 ${exclu ? "opacity-45" : ""}`}>
                      <p className="font-lecture text-[14.5px] leading-snug line-clamp-2">
                        {a.titreLivre}
                      </p>
                      {/* Le titre de la liseuse n'est montré que s'il diffère :
                          sinon c'est du bruit sur chaque ligne. */}
                      {a.titreLivre !== a.titreKindle ? (
                        <p className="truncate text-[11px] text-encre-45">
                          liseuse : {a.titreKindle}
                        </p>
                      ) : null}
                    </div>
                    <span className="chiffres shrink-0 text-[13px] font-semibold text-rose-fonce">
                      {nombre(a.surlignages.length)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {orphelins.length > 0 ? (
          <>
            <h2 className="mt-5 text-[11.5px] font-bold tracking-[0.14em] text-encre-45 uppercase">
              Sans correspondance
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-encre-45">
              Ces livres ne sont pas dans ta bibliothèque. Ajoute-les, puis
              relance l&apos;import : les surlignages déjà présents ne seront
              pas dupliqués.
            </p>
            <ul className="mt-2 space-y-1">
              {orphelins.slice(0, 12).map((a) => (
                <li key={a.titreKindle} className="text-[13px] text-encre-70">
                  {a.titreKindle}
                  <span className="chiffres text-encre-45">
                    {" "}
                    · {nombre(a.surlignages.length)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {erreur ? (
          <p className="mt-4 rounded-tuile bg-[#FBE9ED] px-4 py-3 text-[13px] text-[#A8324A]">
            {erreur}
          </p>
        ) : null}

        <div className="mt-6 flex gap-2">
          <Bouton
            variante="fantome"
            onClick={() => {
              setAnalyse(null);
              setAppariements([]);
              setExclus(new Set());
              setEtape("attente");
            }}
          >
            Annuler
          </Bouton>
          <Bouton
            className="flex-1"
            onClick={lancer}
            disabled={retenusCount === 0}
          >
            {retenusCount === 0
              ? "Rien à importer"
              : `Importer ${nombre(retenusCount)} citations`}
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
          <li>Branche la liseuse à un ordinateur en USB.</li>
          <li>
            Ouvre le disque <em>Kindle</em>, puis le dossier{" "}
            <em>documents</em>.
          </li>
          <li>
            Le fichier s&apos;appelle <em>My Clippings.txt</em>.
          </li>
        </ol>
        <p className="mt-3 text-[12.5px] leading-relaxed text-encre-45">
          Amazon n&apos;ouvre aucune API de lecture : ce fichier est la seule
          voie stable. En revanche il ne bouge pas, et rien n&apos;est à
          autoriser.
        </p>
      </div>

      <input
        ref={champ}
        type="file"
        accept=".txt,text/plain"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void choisirFichier(f);
        }}
      />

      <div className="mt-4">
        <Bouton taille="lg" onClick={() => champ.current?.click()}>
          Choisir My Clippings.txt
        </Bouton>
      </div>

      {erreur ? (
        <p className="mt-3 rounded-tuile bg-[#FBE9ED] px-4 py-3 text-[13px] text-[#A8324A]">
          {erreur}
        </p>
      ) : null}

      <p className="mt-4 text-[13px] leading-relaxed text-encre-45">
        Le fichier est lu dans le navigateur. Tu verras les rapprochements
        avant que quoi que ce soit ne soit enregistré.
      </p>
    </div>
  );
}
