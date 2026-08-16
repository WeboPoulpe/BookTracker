"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Couverture } from "@/components/Couverture";
import { Bouton } from "@/components/ui/Bouton";
import { Feuille } from "@/components/ui/Feuille";
import type { LivreListe } from "@/db/requetes/livres";
import { envoyer } from "@/lib/client-api";
import { nombre, pluriel } from "@/lib/format";

/** 0 → 2, du simple désir à la prochaine lecture décidée. */
export const COLONNES = [
  { valeur: 0, libelle: "Envie", teinte: "#E6E2EE" },
  { valeur: 1, libelle: "Bientôt", teinte: "#F2C4D8" },
  { valeur: 2, libelle: "Suivant", teinte: "#BBD4C4" },
] as const;

export function Pal({ livres }: { livres: LivreListe[] }) {
  const router = useRouter();
  const [priorites, setPriorites] = useState<Record<number, number>>(() =>
    Object.fromEntries(livres.map((l) => [l.id, l.priorite ?? 0])),
  );
  const [tirage, setTirage] = useState<LivreListe | null>(null);
  const [ouverte, setOuverte] = useState(false);

  const parColonne = useMemo(() => {
    const m = new Map<number, LivreListe[]>(COLONNES.map((c) => [c.valeur, []]));
    for (const l of livres) {
      const p = Math.min(2, priorites[l.id] ?? 0);
      m.get(p)!.push(l);
    }
    return m;
  }, [livres, priorites]);

  async function deplacer(livre: LivreListe, vers: number) {
    const avant = priorites[livre.id] ?? 0;
    setPriorites((p) => ({ ...p, [livre.id]: vers }));

    const r = await envoyer({
      url: `/api/livres/${livre.id}`,
      methode: "PATCH",
      file: { table: "livres", operation: "modifier" },
      corps: { id: livre.id, priorite: vers },
    });

    if (r.statut === "erreur") {
      setPriorites((p) => ({ ...p, [livre.id]: avant }));
      return;
    }
    if (r.statut === "ok") router.refresh();
  }

  /**
   * Tirage pondéré par la priorité : « Suivant » sort trois fois plus
   * souvent qu'« Envie ». Un tirage uniforme ignorerait le travail de
   * priorisation qu'on vient de faire.
   */
  function choisirPourMoi() {
    if (livres.length === 0) return;

    const poids = livres.map((l) => 1 + (Math.min(2, priorites[l.id] ?? 0) * 1.5));
    const total = poids.reduce((s, p) => s + p, 0);
    let seuil = Math.random() * total;

    for (let i = 0; i < livres.length; i++) {
      seuil -= poids[i];
      if (seuil <= 0) {
        setTirage(livres[i]);
        setOuverte(true);
        return;
      }
    }
    setTirage(livres[livres.length - 1]);
    setOuverte(true);
  }

  return (
    <>
      <div className="px-5 pb-2">
        <Bouton variante="doux" taille="lg" onClick={choisirPourMoi}>
          Choisis pour moi
        </Bouton>
      </div>

      <div className="space-y-6 px-5 pt-3 pb-10">
        {COLONNES.map((colonne) => {
          const liste = parColonne.get(colonne.valeur) ?? [];
          return (
            <section key={colonne.valeur}>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-pilule"
                  style={{ backgroundColor: colonne.teinte }}
                />
                <h2 className="text-[13px] font-semibold tracking-wide text-encre-45 uppercase">
                  {colonne.libelle}
                </h2>
                <span className="chiffres text-[13px] text-encre-45">
                  {nombre(liste.length)}
                </span>
              </div>

              {liste.length === 0 ? (
                <p className="mt-2 text-[13px] text-encre-45">
                  Rien ici pour l&apos;instant.
                </p>
              ) : (
                <ul className="mt-2.5 space-y-2">
                  {liste.map((l) => (
                    <li key={l.id} className="carte flex items-center gap-3 p-2.5">
                      <Link href={`/bibliotheque/${l.id}`} className="shrink-0">
                        <Couverture
                          titre={l.titre}
                          auteur={l.auteur}
                          url={l.couvertureUrl}
                          genre={l.genre}
                          className="h-[62px] w-[42px]"
                          sizes="42px"
                        />
                      </Link>

                      <div className="min-w-0 flex-1">
                        <Link href={`/bibliotheque/${l.id}`}>
                          <p className="font-lecture text-[14px] leading-snug line-clamp-2">
                            {l.titre}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-encre-45">
                            {l.auteur}
                            {l.pages ? ` · ${nombre(l.pages)} p.` : ""}
                          </p>
                        </Link>

                        <div className="mt-1.5 flex gap-1">
                          {COLONNES.filter((c) => c.valeur !== colonne.valeur).map(
                            (c) => (
                              <button
                                key={c.valeur}
                                type="button"
                                onClick={() => deplacer(l, c.valeur)}
                                className="min-h-[30px] rounded-pilule px-2.5 text-[11px] font-medium text-encre-70 active:scale-95"
                                style={{ backgroundColor: c.teinte }}
                              >
                                → {c.libelle}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <Feuille
        ouverte={ouverte}
        onFermer={() => setOuverte(false)}
        titre="Et si tu lisais…"
        pied={
          <div className="flex gap-2">
            <Bouton variante="fantome" onClick={choisirPourMoi}>
              Retirer
            </Bouton>
            {tirage ? (
              <Bouton
                className="flex-1"
                onClick={() => router.push(`/bibliotheque/${tirage.id}`)}
              >
                Ouvrir la fiche
              </Bouton>
            ) : null}
          </div>
        }
      >
        {tirage ? (
          <div className="flex gap-4 pt-1">
            <Couverture
              titre={tirage.titre}
              auteur={tirage.auteur}
              url={tirage.couvertureUrl}
              genre={tirage.genre}
              className="h-[150px] w-[100px] shrink-0"
              sizes="100px"
            />
            <div className="min-w-0">
              <p className="font-lecture text-[18px] leading-snug font-semibold">
                {tirage.titre}
              </p>
              <p className="mt-1 text-[14px] text-encre-70">{tirage.auteur}</p>
              {tirage.serieNom ? (
                <p className="mt-1 text-[13px] text-encre-45">
                  {tirage.serieNom}
                </p>
              ) : null}
              {tirage.pages ? (
                <p className="chiffres mt-2 text-[13px] text-encre-45">
                  {pluriel(tirage.pages, "page")}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </Feuille>
    </>
  );
}
