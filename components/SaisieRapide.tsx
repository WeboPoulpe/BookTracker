"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Bouton } from "@/components/ui/Bouton";
import { Feuille } from "@/components/ui/Feuille";
import { Segments } from "@/components/ui/Champ";
import { duree, pourcent, progression } from "@/lib/format";

type Livre = {
  id: number;
  titre: string;
  pages: number | null;
  dureeMinutes: number | null;
  format: "papier" | "ebook" | "audio" | null;
  pageAtteinte: number | null;
  minutesCumulees: number | null;
};

/**
 * Feuille de saisie d'une session.
 *
 * Objectif du §1 : moins de 5 secondes, d'une seule main, depuis le lit.
 * D'où le pavé numérique en ouverture, les incréments préréglés, et un
 * unique bouton de validation atteignable au pouce.
 */
export function SaisieRapide({
  livre,
  ouverte,
  onFermer,
}: {
  livre: Livre;
  ouverte: boolean;
  onFermer: () => void;
}) {
  const router = useRouter();

  const audio = livre.format === "audio";
  const [mode, setMode] = useState<"page" | "minutes">(audio ? "minutes" : "page");
  const [page, setPage] = useState("");
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Réinitialisation à chaque ouverture : une feuille qui rouvre avec la
  // saisie précédente fait douter de ce qui a été enregistré.
  useEffect(() => {
    if (!ouverte) return;
    setMode(audio ? "minutes" : "page");
    setPage(livre.pageAtteinte ? String(livre.pageAtteinte) : "");
    setMinutes("");
    setNote("");
    setErreur(null);
  }, [ouverte, audio, livre.pageAtteinte]);

  const pageNum = Number.parseInt(page, 10);
  const avance =
    mode === "page" ? progression(pageNum, livre.pages) : null;

  function decale(n: number) {
    const base = Number.isFinite(pageNum) ? pageNum : (livre.pageAtteinte ?? 0);
    const cible = Math.max(0, base + n);
    setPage(String(livre.pages ? Math.min(cible, livre.pages) : cible));
  }

  async function enregistrer(termine = false) {
    setEnvoi(true);
    setErreur(null);

    try {
      const r = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          livreId: livre.id,
          pageAtteinte: mode === "page" && page ? Number(page) : null,
          minutes: mode === "minutes" && minutes ? Number(minutes) : null,
          noteRapide: note.trim() || null,
          termine,
        }),
      });

      const data = await r.json();
      if (!r.ok) {
        setErreur(data?.erreur?.message ?? "Enregistrement impossible.");
        return;
      }

      onFermer();
      router.refresh();
    } catch {
      // TODO(hors ligne) : basculer dans la file Dexie au lieu d'échouer
      setErreur("Réseau indisponible.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Enregistrer ma page"
      pied={
        <div className="flex gap-2">
          <Bouton
            variante="fantome"
            onClick={() => enregistrer(true)}
            disabled={envoi}
          >
            Terminé
          </Bouton>
          <Bouton
            className="flex-1"
            onClick={() => enregistrer(false)}
            disabled={envoi || (!page && !minutes)}
          >
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </Bouton>
        </div>
      }
    >
      <p className="font-lecture text-[15px] text-encre-70">{livre.titre}</p>

      {livre.pages && livre.dureeMinutes ? (
        <div className="mt-3">
          <Segments
            valeur={mode}
            onChange={setMode}
            options={[
              { valeur: "page", libelle: "Page" },
              { valeur: "minutes", libelle: "Minutes" },
            ]}
          />
        </div>
      ) : null}

      {mode === "page" ? (
        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              value={page}
              onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))}
              placeholder="0"
              className="chiffres w-full min-w-0 border-b-2 border-bordure bg-transparent pb-1 text-center font-display text-[3.25rem] leading-none font-semibold outline-none focus:border-tranche"
            />
            {livre.pages ? (
              <span className="chiffres shrink-0 text-lg text-encre-45">
                / {livre.pages}
              </span>
            ) : null}
          </div>

          {avance !== null ? (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-pilule bg-bordure">
                <div
                  className="h-full rounded-pilule bg-sauge transition-[width] duration-300"
                  style={{ width: `${Math.round(avance * 100)}%` }}
                />
              </div>
              <p className="chiffres mt-1.5 text-center text-[13px] text-encre-45">
                {pourcent(avance)}
              </p>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-4 gap-2">
            {[5, 10, 25, 50].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => decale(n)}
                className="chiffres min-h-[44px] rounded-carte bg-papier-doux text-[15px] font-medium text-encre-70 active:scale-95 active:bg-encre/5"
              >
                +{n}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-baseline justify-center gap-2">
            <input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))}
              placeholder="0"
              className="chiffres w-32 border-b-2 border-bordure bg-transparent pb-1 text-center font-display text-[3.25rem] leading-none font-semibold outline-none focus:border-tranche"
            />
            <span className="shrink-0 text-lg text-encre-45">min</span>
          </div>

          {livre.minutesCumulees ? (
            <p className="chiffres mt-2 text-center text-[13px] text-encre-45">
              Déjà écouté : {duree(livre.minutesCumulees)}
            </p>
          ) : null}

          <div className="mt-4 grid grid-cols-4 gap-2">
            {[15, 30, 45, 60].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMinutes(String(n))}
                className="chiffres min-h-[44px] rounded-carte bg-papier-doux text-[15px] font-medium text-encre-70 active:scale-95 active:bg-encre/5"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Une note ? (facultatif)"
        className="mt-4 w-full rounded-carte border border-bordure bg-papier-doux px-3.5 py-2.5 outline-none focus:border-tranche"
      />

      {erreur ? (
        <p className="mt-3 rounded-carte bg-[#FBE9ED] px-3.5 py-2.5 text-[13px] text-[#A8324A]">
          {erreur}
        </p>
      ) : null}
    </Feuille>
  );
}
