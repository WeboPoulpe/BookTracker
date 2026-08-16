"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { RESSORT } from "@/lib/anim";
import { compterEnAttente, rejouer } from "@/lib/offline";
import { pluriel } from "@/lib/format";

/**
 * Bandeau d'état réseau et reprise de la file.
 *
 * Sans retour visible, une saisie hors ligne ressemble à une saisie perdue.
 * C'est ce doute qui fait réouvrir l'app pour vérifier — exactement ce que
 * la file est censée éviter.
 */
export function EtatReseau() {
  const router = useRouter();
  const [horsLigne, setHorsLigne] = useState(false);
  const [attente, setAttente] = useState(0);
  const [synchro, setSynchro] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rafraichirCompteur = useCallback(async () => {
    setAttente(await compterEnAttente());
  }, []);

  const synchroniser = useCallback(async () => {
    if (synchro) return;
    setSynchro(true);
    try {
      const bilan = await rejouer();
      await rafraichirCompteur();

      if (bilan.rejouees > 0) {
        setMessage(
          `${pluriel(bilan.rejouees, "modification enregistrée", "modifications enregistrées")}.`,
        );
        router.refresh();
      }
      if (bilan.abandonnees > 0) {
        setMessage(
          `${pluriel(bilan.abandonnees, "modification abandonnée", "modifications abandonnées")} — le livre concerné n'existe plus.`,
        );
      }
    } finally {
      setSynchro(false);
    }
  }, [synchro, rafraichirCompteur, router]);

  useEffect(() => {
    setHorsLigne(!navigator.onLine);
    void rafraichirCompteur();

    const revenu = () => {
      setHorsLigne(false);
      void synchroniser();
    };
    const parti = () => setHorsLigne(true);

    window.addEventListener("online", revenu);
    window.addEventListener("offline", parti);

    // L'événement `online` ne se déclenche pas si l'app était fermée au
    // moment du retour du réseau : on tente aussi une reprise au montage.
    if (navigator.onLine) void synchroniser();

    // Les mutations mises en file par d'autres écrans ne préviennent pas.
    const minuteur = setInterval(rafraichirCompteur, 4000);

    return () => {
      window.removeEventListener("online", revenu);
      window.removeEventListener("offline", parti);
      clearInterval(minuteur);
    };
    // Volontairement au montage seul : `synchroniser` change à chaque rendu,
    // le remettre en dépendance réabonnerait les écouteurs en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  if (!horsLigne && attente === 0 && !message) return null;

  const teinte = horsLigne
    ? { fond: "#F6D9B8", texte: "#5C3A18" }
    : message && attente === 0
      ? { fond: "#BBD4C4", texte: "#1F4033" }
      : { fond: "#F2C4D8", texte: "#7A2F4D" };

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={RESSORT}
      className="mx-3 mb-2 shrink-0 rounded-pilule px-4 py-2 text-center text-[12.5px] font-semibold shadow-carte"
      style={{ backgroundColor: teinte.fond, color: teinte.texte }}
    >
      {horsLigne ? (
        <>
          Hors ligne
          {attente > 0
            ? ` · ${pluriel(attente, "modification en attente", "modifications en attente")}`
            : " · tes saisies seront enregistrées au retour du réseau"}
        </>
      ) : attente > 0 ? (
        <button type="button" onClick={synchroniser} className="underline">
          {synchro
            ? "Synchronisation…"
            : `${pluriel(attente, "modification à synchroniser", "modifications à synchroniser")} — toucher pour réessayer`}
        </button>
      ) : (
        message
      )}
    </motion.div>
  );
}
