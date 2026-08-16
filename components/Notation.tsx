"use client";

import { motion } from "motion/react";
import { useState } from "react";

import { Bouton } from "@/components/ui/Bouton";
import { Feuille } from "@/components/ui/Feuille";
import { IconeEtoile } from "@/components/ui/Icones";
import { RESSORT, RESSORT_REBOND, TOUCHER } from "@/lib/anim";
import { envoyer } from "@/lib/client-api";
import { AXES, HUMEURS, type CleAxe } from "@/lib/notation";

/* Les axes et les humeurs vivent dans lib/notation.ts : une constante
   exportée d'un module "use client" n'est pas lisible depuis un composant
   serveur. */

/** Cinq étoiles au demi-point : appui à gauche = demie, à droite = entière. */
function Etoiles({
  note,
  onChange,
}: {
  note: number | null;
  onChange: (n: number | null) => void;
}) {
  const [survol, setSurvol] = useState<number | null>(null);
  const affichee = survol ?? note ?? 0;

  return (
    <div>
      <div className="flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((rang) => {
          const remplissage = Math.max(0, Math.min(1, affichee - (rang - 1)));
          return (
            <motion.span
              key={rang}
              className="relative"
              animate={{ scale: remplissage > 0 ? 1 : 0.94 }}
              transition={RESSORT_REBOND}
            >
              <IconeEtoile
                remplissage={remplissage}
                className={`h-10 w-10 ${remplissage > 0 ? "text-dorure" : "text-encre-20"}`}
              />
              {/* Deux zones de 20 px : sous ce seuil, viser une demi-étoile
                  au pouce devient un jeu d'adresse. */}
              <button
                type="button"
                aria-label={`${rang - 0.5} sur 5`}
                onPointerEnter={() => setSurvol(rang - 0.5)}
                onPointerLeave={() => setSurvol(null)}
                onClick={() => onChange(rang - 0.5)}
                className="absolute inset-y-0 left-0 w-1/2"
              />
              <button
                type="button"
                aria-label={`${rang} sur 5`}
                onPointerEnter={() => setSurvol(rang)}
                onPointerLeave={() => setSurvol(null)}
                onClick={() => onChange(rang)}
                className="absolute inset-y-0 right-0 w-1/2"
              />
            </motion.span>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-center gap-3">
        <span className="chiffres text-[15px] font-semibold">
          {note != null ? `${note.toLocaleString("fr-FR")} / 5` : "Non noté"}
        </span>
        {note != null ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[12px] text-encre-45 underline"
          >
            effacer
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Axe 0–5. Un appui sur la valeur courante l'efface — l'axe est facultatif. */
function Axe({
  libelle,
  aide,
  valeur,
  onChange,
}: {
  libelle: string;
  aide: string;
  valeur: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-encre-70">{libelle}</span>
        <span className="text-[11px] text-encre-45">
          {valeur != null ? `${valeur}/5` : aide}
        </span>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.button
            key={n}
            type="button"
            whileTap={TOUCHER}
            transition={RESSORT}
            aria-label={`${libelle} ${n} sur 5`}
            aria-pressed={valeur != null && n <= valeur}
            onClick={() => onChange(valeur === n ? null : n)}
            className={`h-8 flex-1 rounded-pilule transition-colors ${
              valeur != null && n <= valeur
                ? "bg-dragee"
                : "bg-rose-voile ring-1 ring-rose-poudre"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

type Livre = {
  id: number;
  note: number | null;
  axeIntrigue: number | null;
  axePersonnages: number | null;
  axeEmotion: number | null;
  axeThemes: number | null;
  humeur: string | null;
  emoji: string | null;
  avis: string | null;
};

export function FeuilleNotation({
  livre,
  ouverte,
  onFermer,
  onEnregistre,
}: {
  livre: Livre;
  ouverte: boolean;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const [note, setNote] = useState<number | null>(livre.note);
  const [axes, setAxes] = useState<Record<CleAxe, number | null>>({
    axeIntrigue: livre.axeIntrigue,
    axePersonnages: livre.axePersonnages,
    axeEmotion: livre.axeEmotion,
    axeThemes: livre.axeThemes,
  });
  const [humeur, setHumeur] = useState(livre.humeur ?? "");
  const [emoji, setEmoji] = useState(livre.emoji ?? "");
  const [avis, setAvis] = useState(livre.avis ?? "");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    setEnvoi(true);
    setErreur(null);

    const r = await envoyer({
      url: `/api/livres/${livre.id}`,
      methode: "PATCH",
      file: { table: "livres", operation: "modifier" },
      corps: {
        id: livre.id,
        note,
        ...axes,
        humeur: humeur.trim() || null,
        emoji: emoji || null,
        avis: avis.trim() || null,
      },
    });

    setEnvoi(false);

    if (r.statut === "erreur") {
      setErreur(r.message);
      return;
    }
    onFermer();
    onEnregistre();
  }

  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Ma note"
      pied={
        <Bouton taille="lg" onClick={enregistrer} disabled={envoi}>
          {envoi ? "Enregistrement…" : "Enregistrer"}
        </Bouton>
      }
    >
      <div className="space-y-6 pt-2">
        <Etoiles note={note} onChange={setNote} />

        <div className="space-y-4">
          <p className="text-[11.5px] font-bold tracking-[0.14em] text-rose-fonce uppercase">
            Ressenti — facultatif
          </p>
          {AXES.map((a) => (
            <Axe
              key={a.cle}
              libelle={a.libelle}
              aide={a.aide}
              valeur={axes[a.cle]}
              onChange={(v) => setAxes((x) => ({ ...x, [a.cle]: v }))}
            />
          ))}
        </div>

        <div>
          <p className="mb-2 text-[11.5px] font-bold tracking-[0.14em] text-rose-fonce uppercase">
            Humeur
          </p>
          <div className="flex flex-wrap gap-1.5">
            {HUMEURS.map((h) => {
              const actif = h.mot === humeur;
              return (
                <motion.button
                  key={h.mot}
                  type="button"
                  whileTap={TOUCHER}
                  transition={RESSORT}
                  onClick={() => {
                    // Un second appui désélectionne : sans ça, impossible de
                    // revenir à « aucune humeur » une fois qu'on en a mis une.
                    setHumeur(actif ? "" : h.mot);
                    setEmoji(actif ? "" : h.emoji);
                  }}
                  className={`flex min-h-[36px] items-center gap-1.5 rounded-pilule px-3 text-[12.5px] font-medium ${
                    actif
                      ? "degrade-dragee text-rose-encre shadow-dragee"
                      : "bg-rose-voile text-encre-70 ring-1 ring-rose-poudre"
                  }`}
                >
                  <span aria-hidden="true">{h.emoji}</span>
                  {h.mot}
                </motion.button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-encre-70">
            Mon avis
          </span>
          <textarea
            value={avis}
            onChange={(e) => setAvis(e.target.value)}
            rows={5}
            placeholder="Ce que tu en as pensé, pour toi dans un an."
            className="w-full resize-y rounded-tuile bg-rose-voile px-4 py-3 font-lecture text-[15px] leading-relaxed ring-1 ring-rose-poudre outline-none focus:bg-white focus:ring-2 focus:ring-dragee"
          />
        </label>

        {erreur ? (
          <p className="rounded-tuile bg-[#FBE9ED] px-4 py-3 text-[13px] text-[#A8324A]">
            {erreur}
          </p>
        ) : null}
      </div>
    </Feuille>
  );
}
