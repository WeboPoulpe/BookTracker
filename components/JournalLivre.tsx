"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Confirmation } from "@/components/ui/Confirmation";
import { RESSORT } from "@/lib/anim";
import { dateCourte, duree, nombre } from "@/lib/format";

type Session = {
  id: number;
  jour: string;
  pageAtteinte: number | null;
  minutes: number | null;
  noteRapide: string | null;
};

type Lecture = {
  id: number;
  debut: string | null;
  fin: string | null;
  abandonnee: boolean | null;
};

/**
 * Journal des sessions, chaque ligne supprimable.
 *
 * Une session mal saisie — un chiffre de trop sur le pavé numérique — fausse
 * la progression et le rythme. Il faut pouvoir la retirer sans toucher au
 * reste de l'historique.
 */
export function JournalLivre({ sessions }: { sessions: Session[] }) {
  const router = useRouter();
  const [aSupprimer, setASupprimer] = useState<Session | null>(null);
  const [retirees, setRetirees] = useState<Set<number>>(new Set());

  async function supprimer() {
    if (!aSupprimer) return;
    const id = aSupprimer.id;

    try {
      const r = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (!r.ok) return;
      // Retrait local immédiat : le rafraîchissement serveur prend un
      // instant, pendant lequel la ligne resterait visible.
      setRetirees((s) => new Set(s).add(id));
      setASupprimer(null);
      router.refresh();
    } catch {
      // Hors ligne : on ne met pas de suppression en file. Effacer une
      // session est rare et sans urgence, et une file de suppressions
      // rejouée sur des identifiants périmés ferait plus de dégâts.
    }
  }

  const visibles = sessions.filter((s) => !retirees.has(s.id));

  if (visibles.length === 0) {
    return (
      <p className="text-[14px] text-encre-45">Aucune session enregistrée.</p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-bordure rounded-carte bg-white/85 px-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
        <AnimatePresence initial={false}>
          {visibles.slice(0, 40).map((s) => (
            <motion.li
              key={s.id}
              layout
              exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
              transition={RESSORT}
              className="flex items-baseline gap-3 py-3"
            >
              <span className="chiffres w-14 shrink-0 text-[12.5px] text-encre-45">
                {dateCourte(s.jour)}
              </span>
              <span className="chiffres flex-1 text-[14px] font-medium">
                {s.pageAtteinte != null ? `page ${nombre(s.pageAtteinte)}` : null}
                {s.pageAtteinte != null && s.minutes != null ? " · " : null}
                {s.minutes != null ? duree(s.minutes) : null}
              </span>
              {s.noteRapide ? (
                <span className="max-w-[38%] truncate text-[12.5px] text-encre-45 italic">
                  {s.noteRapide}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setASupprimer(s)}
                aria-label={`Supprimer la session du ${dateCourte(s.jour)}`}
                className="shrink-0 px-1 text-[16px] leading-none text-encre-20 active:text-[#A8324A]"
              >
                ×
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <Confirmation
        ouverte={aSupprimer !== null}
        titre="Supprimer cette session ?"
        texte={
          aSupprimer
            ? `Session du ${dateCourte(aSupprimer.jour)}. La progression du livre sera recalculée.`
            : undefined
        }
        onConfirmer={supprimer}
        onAnnuler={() => setASupprimer(null)}
      />
    </>
  );
}

/**
 * Historique des lectures — une ligne par passage dans le livre.
 *
 * Supprimer une lecture emporte ses sessions : c'est la période entière
 * qu'on efface, pas seulement ses bornes.
 */
export function LecturesLivre({ lectures }: { lectures: Lecture[] }) {
  const router = useRouter();
  const [aSupprimer, setASupprimer] = useState<Lecture | null>(null);
  const [retirees, setRetirees] = useState<Set<number>>(new Set());

  async function supprimer() {
    if (!aSupprimer) return;
    const id = aSupprimer.id;
    try {
      const r = await fetch(`/api/lectures/${id}`, { method: "DELETE" });
      if (!r.ok) return;
      setRetirees((s) => new Set(s).add(id));
      setASupprimer(null);
      router.refresh();
    } catch {
      /* hors ligne : voir JournalLivre */
    }
  }

  const visibles = lectures.filter((l) => !retirees.has(l.id));
  if (visibles.length === 0) return null;

  return (
    <>
      <ul className="space-y-1.5">
        <AnimatePresence initial={false}>
          {visibles.map((l, i) => (
            <motion.li
              key={l.id}
              layout
              exit={{ opacity: 0, height: 0 }}
              transition={RESSORT}
              className="chiffres flex items-baseline gap-2 text-[13px] text-encre-70"
            >
              <span className="flex-1">
                {visibles.length > 1
                  ? `${visibles.length - i}${visibles.length - i === 1 ? "re" : "e"} lecture · `
                  : ""}
                {dateCourte(l.debut)} → {l.fin ? dateCourte(l.fin) : "en cours"}
                {l.abandonnee ? " · abandonnée" : ""}
              </span>
              <button
                type="button"
                onClick={() => setASupprimer(l)}
                aria-label="Supprimer cette lecture"
                className="shrink-0 px-1 text-[16px] leading-none text-encre-20 active:text-[#A8324A]"
              >
                ×
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <Confirmation
        ouverte={aSupprimer !== null}
        titre="Supprimer cette lecture ?"
        texte="Les sessions enregistrées pendant cette période seront supprimées avec elle."
        onConfirmer={supprimer}
        onAnnuler={() => setASupprimer(null)}
      />
    </>
  );
}
