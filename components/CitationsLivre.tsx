"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { Confirmation } from "@/components/ui/Confirmation";
import { Feuille } from "@/components/ui/Feuille";
import { RESSORT } from "@/lib/anim";
import { envoyer } from "@/lib/client-api";
import { depuis } from "@/lib/format";

type Citation = {
  id: number;
  texte: string;
  page: number | null;
  creeLe: Date | string | null;
};

/**
 * Citations d'un livre : ajout, modification, suppression.
 *
 * « C'est ce qu'on relit avec le plus de plaisir un an après » (§2) — donc
 * ce qu'on doit pouvoir corriger : une citation saisie au clavier tactile,
 * de nuit, comporte souvent une coquille.
 */
export function CitationsLivre({
  livreId,
  citations,
}: {
  livreId: number;
  citations: Citation[];
}) {
  const router = useRouter();
  const [feuille, setFeuille] = useState(false);
  const [enEdition, setEnEdition] = useState<Citation | null>(null);
  const [aSupprimer, setASupprimer] = useState<Citation | null>(null);
  const [retirees, setRetirees] = useState<Set<number>>(new Set());

  const [texte, setTexte] = useState("");
  const [page, setPage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function ouvrir(c?: Citation) {
    setEnEdition(c ?? null);
    setTexte(c?.texte ?? "");
    setPage(c?.page != null ? String(c.page) : "");
    setErreur(null);
    setFeuille(true);
  }

  async function enregistrer() {
    if (!texte.trim()) {
      setErreur("La citation est vide.");
      return;
    }

    setEnvoi(true);
    setErreur(null);

    const r = enEdition
      ? await envoyer({
          url: `/api/citations/${enEdition.id}`,
          methode: "PATCH",
          file: { table: "citations", operation: "modifier" },
          corps: { texte: texte.trim(), page: page || null },
        })
      : await envoyer({
          url: "/api/citations",
          methode: "POST",
          file: { table: "citations", operation: "creer" },
          corps: { livreId, texte: texte.trim(), page: page || null },
        });

    setEnvoi(false);

    if (r.statut === "erreur") {
      setErreur(r.message);
      return;
    }

    setFeuille(false);
    if (r.statut === "ok") router.refresh();
  }

  async function supprimer() {
    if (!aSupprimer) return;
    const id = aSupprimer.id;
    try {
      const r = await fetch(`/api/citations/${id}`, { method: "DELETE" });
      if (!r.ok) return;
      setRetirees((s) => new Set(s).add(id));
      setASupprimer(null);
      router.refresh();
    } catch {
      /* hors ligne : les suppressions ne sont pas mises en file */
    }
  }

  const visibles = citations.filter((c) => !retirees.has(c.id));

  return (
    <>
      {visibles.length === 0 ? (
        <p className="text-[14px] text-encre-45">
          Aucune citation pour ce livre.
        </p>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {visibles.map((c) => (
              <motion.li
                key={c.id}
                layout
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={RESSORT}
                className="rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm"
              >
                <blockquote className="border-l-2 border-dragee pl-3.5 font-lecture text-[15.5px] leading-relaxed">
                  {c.texte}
                </blockquote>
                <div className="mt-2 flex items-baseline justify-between gap-3">
                  <p className="chiffres text-[12px] text-encre-45">
                    {c.page ? `page ${c.page} · ` : ""}
                    {depuis(c.creeLe)}
                  </p>
                  <div className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      onClick={() => ouvrir(c)}
                      className="text-[12px] font-medium text-rose-fonce"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => setASupprimer(c)}
                      className="text-[12px] font-medium text-encre-45"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <div className="mt-3">
        <Bouton variante="doux" taille="sm" onClick={() => ouvrir()}>
          Ajouter une citation
        </Bouton>
      </div>

      <Feuille
        ouverte={feuille}
        onFermer={() => setFeuille(false)}
        titre={enEdition ? "Modifier la citation" : "Nouvelle citation"}
        pied={
          <div className="flex gap-2">
            <Bouton
              variante="fantome"
              onClick={() => setFeuille(false)}
              disabled={envoi}
            >
              Annuler
            </Bouton>
            <Bouton className="flex-1" onClick={enregistrer} disabled={envoi}>
              {envoi ? "Enregistrement…" : "Enregistrer"}
            </Bouton>
          </div>
        }
      >
        <div className="space-y-4 pt-1">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-encre-70">
              Citation
            </span>
            <textarea
              autoFocus
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              rows={6}
              placeholder="Le passage qui t'a arrêtée."
              className="w-full resize-y rounded-tuile bg-rose-voile px-4 py-3 font-lecture text-[16px] leading-relaxed ring-1 ring-rose-poudre outline-none focus:bg-white focus:ring-2 focus:ring-dragee"
            />
          </label>

          <Champ
            label="Page"
            inputMode="numeric"
            value={page}
            onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))}
            placeholder="182"
            aide="Facultatif"
          />

          {erreur ? (
            <p className="rounded-tuile bg-[#FBE9ED] px-4 py-3 text-[13px] text-[#A8324A]">
              {erreur}
            </p>
          ) : null}
        </div>
      </Feuille>

      <Confirmation
        ouverte={aSupprimer !== null}
        titre="Supprimer cette citation ?"
        texte={
          aSupprimer
            ? `« ${aSupprimer.texte.slice(0, 90)}${aSupprimer.texte.length > 90 ? "…" : ""} »`
            : undefined
        }
        onConfirmer={supprimer}
        onAnnuler={() => setASupprimer(null)}
      />
    </>
  );
}
