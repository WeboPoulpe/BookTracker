"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { RESSORT } from "@/lib/anim";

/**
 * Bloc de texte long, replié par défaut.
 *
 * Un synopsis fait dix lignes, un résumé d'intrigue davantage : déplié
 * d'office, il repousserait le journal et les citations hors de l'écran.
 * On garde un aperçu de trois lignes, assez pour reconnaître le texte.
 */
export function TexteDepliable({
  texte,
  lignes = 3,
}: {
  texte: string;
  lignes?: number;
}) {
  const [ouvert, setOuvert] = useState(false);

  // En dessous, replier coûte un geste pour rien.
  const long = texte.length > 220;

  return (
    <div className="rounded-carte bg-white/85 p-4 shadow-carte ring-1 ring-white/70 backdrop-blur-sm">
      <AnimatePresence initial={false} mode="wait">
        <motion.p
          key={ouvert ? "ouvert" : "replie"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="font-lecture text-[15.5px] leading-relaxed whitespace-pre-line"
          style={
            ouvert || !long
              ? undefined
              : {
                  display: "-webkit-box",
                  WebkitLineClamp: lignes,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }
          }
        >
          {texte}
        </motion.p>
      </AnimatePresence>

      {long ? (
        <motion.button
          type="button"
          layout
          transition={RESSORT}
          onClick={() => setOuvert((o) => !o)}
          className="mt-2 text-[12.5px] font-semibold text-rose-fonce"
        >
          {ouvert ? "Replier" : "Lire la suite"}
        </motion.button>
      ) : null}
    </div>
  );
}
