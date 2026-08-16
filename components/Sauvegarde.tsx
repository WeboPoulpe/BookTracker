"use client";

import { useState } from "react";

import { Bouton } from "@/components/ui/Bouton";
import { nombre } from "@/lib/format";

type Bilan = {
  jour: string;
  octets: number;
  livres: number;
  citations: number;
  purgees: number;
  conservees: number;
};

/**
 * Déclenchement manuel de la sauvegarde.
 *
 * Le cron quotidien fait le travail ; ce bouton sert surtout à vérifier que
 * le stockage est bien branché, sans attendre 4 h du matin pour le
 * découvrir. Il rend aussi visible un réglage qui, sinon, ne se manifeste
 * jamais tant qu'il fonctionne.
 */
export function Sauvegarde() {
  const [travail, setTravail] = useState(false);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function lancer() {
    setTravail(true);
    setErreur(null);
    setBilan(null);
    try {
      const r = await fetch("/api/sauvegarde", { method: "POST" });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setErreur(d?.erreur?.message ?? "Sauvegarde impossible.");
        return;
      }
      setBilan(d);
    } catch {
      setErreur("Réseau indisponible.");
    } finally {
      setTravail(false);
    }
  }

  return (
    <div className="px-4 py-3.5">
      <p className="text-[15px] font-medium">Sauvegarde automatique</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-encre-45">
        Chaque nuit à 4 h, un instantané complet est écrit hors de la base —
        une sauvegarde stockée dans la base qu&apos;elle protège ne protège de
        rien. Les trente derniers jours sont conservés.
      </p>

      <div className="mt-3">
        <Bouton
          variante="doux"
          taille="sm"
          onClick={lancer}
          disabled={travail}
        >
          {travail ? "Sauvegarde…" : "Sauvegarder maintenant"}
        </Bouton>
      </div>

      {bilan ? (
        <p className="chiffres mt-3 text-[12.5px] text-[#1F4033]">
          Sauvegardé le {bilan.jour} — {nombre(bilan.livres)} livres,{" "}
          {nombre(bilan.citations)} citations,{" "}
          {nombre(Math.round(bilan.octets / 1024))} ko.
          {bilan.purgees > 0
            ? ` ${nombre(bilan.purgees)} ancienne(s) purgée(s).`
            : ""}
        </p>
      ) : null}

      {erreur ? (
        <p className="mt-3 text-[12.5px] leading-relaxed text-[#A8324A]">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
