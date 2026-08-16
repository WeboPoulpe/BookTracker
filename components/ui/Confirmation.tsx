"use client";

import { useState } from "react";

import { Bouton } from "@/components/ui/Bouton";
import { Feuille } from "@/components/ui/Feuille";

/**
 * Confirmation d'une action irréversible.
 *
 * Feuille modale plutôt que `window.confirm` : la boîte native casse
 * l'illusion d'application, ne se met pas à la charte, et sur iOS en mode
 * autonome elle affiche le nom du domaine.
 *
 * Le bouton destructeur n'est jamais le bouton par défaut ni le mieux placé
 * pour le pouce — supprimer doit demander une seconde d'intention.
 */
export function Confirmation({
  ouverte,
  titre,
  texte,
  libelleAction = "Supprimer",
  onConfirmer,
  onAnnuler,
}: {
  ouverte: boolean;
  titre: string;
  texte?: string;
  libelleAction?: string;
  onConfirmer: () => Promise<void> | void;
  onAnnuler: () => void;
}) {
  const [travail, setTravail] = useState(false);

  async function confirmer() {
    setTravail(true);
    try {
      await onConfirmer();
    } finally {
      setTravail(false);
    }
  }

  return (
    <Feuille
      ouverte={ouverte}
      onFermer={travail ? () => {} : onAnnuler}
      titre={titre}
      pied={
        <div className="flex gap-2">
          <Bouton
            className="flex-1"
            variante="doux"
            onClick={onAnnuler}
            disabled={travail}
          >
            Annuler
          </Bouton>
          <Bouton
            variante="danger"
            onClick={confirmer}
            disabled={travail}
            className="ring-1 ring-[#E8B8C4]"
          >
            {travail ? "…" : libelleAction}
          </Bouton>
        </div>
      }
    >
      {texte ? (
        <p className="pt-1 text-[14.5px] leading-relaxed text-encre-70">
          {texte}
        </p>
      ) : null}
    </Feuille>
  );
}
