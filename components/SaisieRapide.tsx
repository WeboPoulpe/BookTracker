"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { RESSORT, TOUCHER } from "@/lib/anim";

import { Bouton } from "@/components/ui/Bouton";
import { Celebration } from "@/components/ui/Celebration";
import { Feuille } from "@/components/ui/Feuille";
import { Segments } from "@/components/ui/Champ";
import { envoyer } from "@/lib/client-api";
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
  const [fete, setFete] = useState(false);

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

    const r = await envoyer({
      url: "/api/sessions",
      methode: "POST",
      file: { table: "sessions", operation: "session" },
      corps: {
        livreId: livre.id,
        pageAtteinte: mode === "page" && page ? Number(page) : null,
        minutes: mode === "minutes" && minutes ? Number(minutes) : null,
        noteRapide: note.trim() || null,
        termine,
      },
    });

    setEnvoi(false);

    if (r.statut === "erreur") {
      setErreur(r.message);
      return;
    }

    // Mise en file comprise : la feuille se ferme comme si c'était passé.
    // Faire autrement obligerait à réfléchir au réseau au moment précis où
    // l'app promet un geste de moins de cinq secondes.
    onFermer();

    // Le serveur clôt aussi la lecture quand la dernière page est atteinte,
    // sans que l'utilisateur ait touché « Terminé » : on lit sa réponse
    // plutôt que notre propre intention.
    const acheve =
      termine ||
      (r.statut === "ok" &&
        typeof r.data === "object" &&
        r.data !== null &&
        (r.data as { termine?: boolean }).termine === true);

    if (acheve) setFete(true);
    if (r.statut === "ok") router.refresh();
  }

  return (
    <>
    <Celebration
      active={fete}
      titre={livre.titre}
      onFini={() => setFete(false)}
    />
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Enregistrer ma page"
      pied={
        <div className="flex gap-2">
          <Bouton
            variante="doux"
            onClick={() => enregistrer(true)}
            disabled={envoi}
          >
            J&apos;ai fini
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
            <div className="mt-4">
              <div className="h-2.5 overflow-hidden rounded-pilule bg-rose-poudre">
                <motion.div
                  className="degrade-dragee h-full rounded-pilule"
                  animate={{ width: `${Math.round(avance * 100)}%` }}
                  transition={RESSORT}
                />
              </div>
              <p className="chiffres mt-2 text-center text-[13px] font-semibold text-rose-fonce">
                {pourcent(avance)}
              </p>
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-4 gap-2">
            {[5, 10, 25, 50].map((n) => (
              <motion.button
                key={n}
                type="button"
                onClick={() => decale(n)}
                whileTap={TOUCHER}
                transition={RESSORT}
                className="chiffres min-h-[46px] rounded-tuile bg-rose-voile text-[15px] font-semibold text-rose-fonce ring-1 ring-rose-poudre"
              >
                +{n}
              </motion.button>
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

          <div className="mt-5 grid grid-cols-4 gap-2">
            {[15, 30, 45, 60].map((n) => (
              <motion.button
                key={n}
                type="button"
                onClick={() => setMinutes(String(n))}
                whileTap={TOUCHER}
                transition={RESSORT}
                className="chiffres min-h-[46px] rounded-tuile bg-rose-voile text-[15px] font-semibold text-rose-fonce ring-1 ring-rose-poudre"
              >
                {n}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Une note ? (facultatif)"
        className="mt-5 w-full rounded-tuile bg-rose-voile px-4 py-3 outline-none ring-1 ring-rose-poudre focus:ring-2 focus:ring-dragee"
      />

      {erreur ? (
        <p className="mt-3 rounded-tuile bg-[#FBE9ED] px-4 py-3 text-[13px] text-[#A8324A]">
          {erreur}
        </p>
      ) : null}
    </Feuille>
    </>
  );
}
