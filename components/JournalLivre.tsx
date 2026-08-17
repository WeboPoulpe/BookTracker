"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { Confirmation } from "@/components/ui/Confirmation";
import { RESSORT } from "@/lib/anim";
import { aujourdhui } from "@/lib/date";
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
  const [enEdition, setEnEdition] = useState<number | null>(null);

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
              className="chiffres text-[13px] text-encre-70"
            >
              <div className="flex items-baseline gap-2">
                {/* Les dates s'ouvrent d'un appui, là où l'erreur se voit.
                    Un bouton d'édition séparé ajouterait une cible de plus
                    sur une ligne qui en a déjà une. */}
                <button
                  type="button"
                  onClick={() =>
                    setEnEdition((c) => (c === l.id ? null : l.id))
                  }
                  aria-expanded={enEdition === l.id}
                  className="flex-1 text-left active:text-encre"
                >
                  {visibles.length > 1
                    ? `${visibles.length - i}${visibles.length - i === 1 ? "re" : "e"} lecture · `
                    : ""}
                  {dateCourte(l.debut)} → {l.fin ? dateCourte(l.fin) : "en cours"}
                  {l.abandonnee ? " · abandonnée" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setASupprimer(l)}
                  aria-label="Supprimer cette lecture"
                  className="shrink-0 px-1 text-[16px] leading-none text-encre-20 active:text-[#A8324A]"
                >
                  ×
                </button>
              </div>

              <AnimatePresence initial={false}>
                {enEdition === l.id ? (
                  <EditionLecture
                    lecture={l}
                    onFerme={() => setEnEdition(null)}
                    onEnregistre={() => {
                      setEnEdition(null);
                      router.refresh();
                    }}
                  />
                ) : null}
              </AnimatePresence>
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

/**
 * Correction des bornes d'une lecture, dépliée sous sa ligne.
 *
 * Les dates viennent souvent d'un import qui les a devinées — StoryGraph
 * empile plusieurs lectures dans un champ, et à défaut de date de lecture
 * c'est la date d'ajout qui a fait foi. Comme elles commandent le compteur
 * annuel et le rythme, elles doivent se corriger là où on les lit.
 *
 * La date de fin n'apparaît pas tant que la lecture est en cours : c'est son
 * absence qui définit le livre comme en cours, et la poser ici laisserait le
 * statut du livre en désaccord avec son journal.
 */
function EditionLecture({
  lecture,
  onFerme,
  onEnregistre,
}: {
  lecture: Lecture;
  onFerme: () => void;
  onEnregistre: () => void;
}) {
  const [debut, setDebut] = useState(lecture.debut ?? "");
  const [fin, setFin] = useState(lecture.fin ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [encours, setEncours] = useState(false);

  const enLecture = lecture.fin === null;
  const jour = aujourdhui();

  async function enregistrer() {
    setEncours(true);
    setErreur(null);

    // Le serveur revérifie tout : ce garde-fou-ci n'épargne qu'un aller-retour.
    if (debut && fin && debut > fin) {
      setErreur("Le début ne peut pas suivre la fin.");
      setEncours(false);
      return;
    }

    try {
      const r = await fetch(`/api/lectures/${lecture.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debut: debut || null,
          // Une lecture en cours n'envoie pas de fin : le serveur la
          // refuserait, et ce refus n'aurait rien appris à personne.
          ...(enLecture ? {} : { fin }),
        }),
      });

      if (!r.ok) {
        const corps = await r.json().catch(() => null);
        setErreur(corps?.erreur?.message ?? "Enregistrement impossible.");
        return;
      }
      onEnregistre();
    } catch {
      // Contrairement aux sessions, une correction de dates n'est pas mise en
      // file hors ligne : elle est rare, et la rejouer plus tard sur un
      // journal entre-temps modifié ferait plus de dégâts qu'elle n'en répare.
      setErreur("Réseau indisponible. Réessaie une fois connectée.");
    } finally {
      setEncours(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={RESSORT}
      className="overflow-hidden"
    >
      <div className="mt-2 mb-1 space-y-2 rounded-carte bg-white/70 p-3 ring-1 ring-white/80">
        <div className="flex gap-2">
          <Champ
            label="Début"
            type="date"
            max={fin || jour}
            value={debut}
            onChange={(e) => setDebut(e.target.value)}
            className="flex-1"
          />
          {enLecture ? null : (
            <Champ
              label="Fin"
              type="date"
              min={debut || undefined}
              max={jour}
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              className="flex-1"
            />
          )}
        </div>

        {enLecture ? (
          <p className="text-[12px] text-encre-45">
            Lecture en cours : sa date de fin s&apos;inscrira en marquant le
            livre comme lu.
          </p>
        ) : null}

        {erreur ? (
          <p className="text-[12px] text-[#A8324A]">{erreur}</p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Bouton variante="doux" taille="sm" onClick={onFerme}>
            Annuler
          </Bouton>
          <Bouton taille="sm" disabled={encours} onClick={enregistrer}>
            {encours ? "…" : "Enregistrer"}
          </Bouton>
        </div>
      </div>
    </motion.div>
  );
}
