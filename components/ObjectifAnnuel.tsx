"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { RESSORT, TOUCHER } from "@/lib/anim";
import { nombre } from "@/lib/format";

/**
 * Réglage de l'objectif annuel.
 *
 * Deux boutons plutôt qu'un champ de saisie : on ajuste un objectif de
 * quelques unités, et ouvrir un clavier numérique pour passer de 30 à 32
 * serait disproportionné. Le champ reste accessible pour un grand écart.
 */
export function ObjectifAnnuel({ valeur }: { valeur: number }) {
  const router = useRouter();
  const [objectif, setObjectif] = useState(valeur);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Enregistrement différé : sans ça, cinq appuis sur « + » déclencheraient
  // cinq écritures en base pour un seul réglage.
  useEffect(() => {
    if (objectif === valeur) return;

    minuteur.current = setTimeout(async () => {
      setErreur(null);
      try {
        const r = await fetch("/api/utilisateur", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectifAnnuel: objectif }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => null);
          setErreur(d?.erreur?.message ?? "Enregistrement impossible.");
          setObjectif(valeur);
          return;
        }
        setEnregistre(true);
        router.refresh();
      } catch {
        setErreur("Réseau indisponible.");
        setObjectif(valeur);
      }
    }, 700);

    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, [objectif, valeur, router]);

  useEffect(() => {
    if (!enregistre) return;
    const t = setTimeout(() => setEnregistre(false), 2000);
    return () => clearTimeout(t);
  }, [enregistre]);

  const borne = (n: number) => Math.max(0, Math.min(999, n));

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-medium">Objectif annuel</p>
          <p className="text-[12.5px] text-encre-45">
            {objectif === 0
              ? "Aucun objectif — l'anneau disparaît de l'accueil"
              : `${nombre(objectif)} livres à lire cette année`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <motion.button
            type="button"
            whileTap={TOUCHER}
            transition={RESSORT}
            onClick={() => setObjectif((o) => borne(o - 1))}
            disabled={objectif <= 0}
            aria-label="Diminuer l'objectif"
            className="flex h-10 w-10 items-center justify-center rounded-pilule bg-rose-voile text-[18px] font-semibold text-rose-fonce ring-1 ring-rose-poudre disabled:opacity-40"
          >
            −
          </motion.button>

          <input
            inputMode="numeric"
            value={objectif}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value.replace(/\D/g, ""), 10);
              setObjectif(Number.isFinite(n) ? borne(n) : 0);
            }}
            aria-label="Objectif annuel"
            className="chiffres w-14 rounded-tuile bg-rose-voile py-2 text-center text-[17px] font-bold text-encre ring-1 ring-rose-poudre outline-none focus:bg-white focus:ring-2 focus:ring-dragee"
          />

          <motion.button
            type="button"
            whileTap={TOUCHER}
            transition={RESSORT}
            onClick={() => setObjectif((o) => borne(o + 1))}
            disabled={objectif >= 999}
            aria-label="Augmenter l'objectif"
            className="flex h-10 w-10 items-center justify-center rounded-pilule bg-rose-voile text-[18px] font-semibold text-rose-fonce ring-1 ring-rose-poudre disabled:opacity-40"
          >
            +
          </motion.button>
        </div>
      </div>

      {erreur ? (
        <p className="mt-2 text-[12px] text-[#A8324A]">{erreur}</p>
      ) : enregistre ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-[12px] font-medium text-[#1F4033]"
        >
          Objectif enregistré.
        </motion.p>
      ) : null}
    </div>
  );
}
