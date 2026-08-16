"use client";

import { motion } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { IconeFermer, IconeRecherche } from "@/components/ui/Icones";
import { RESSORT } from "@/lib/anim";

/**
 * Recherche dans la bibliothèque.
 *
 * Le filtre existait côté serveur mais aucun champ ne l'alimentait : sur une
 * bibliothèque importée de plusieurs centaines de titres, retrouver un livre
 * dans une grille à trois colonnes était impossible.
 *
 * La requête vit dans l'URL et non dans un état local : le résultat se
 * partage, se met en favori, et le retour arrière du navigateur revient à la
 * recherche précédente au lieu de quitter l'écran.
 */
export function RechercheBibliotheque({ valeur }: { valeur: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [saisie, setSaisie] = useState(valeur);
  const champ = useRef<HTMLInputElement>(null);
  const premierRendu = useRef(true);

  // La valeur peut changer sans passer par le champ — navigation arrière,
  // ou effacement du filtre depuis un autre bouton.
  useEffect(() => setSaisie(valeur), [valeur]);

  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    if (saisie === valeur) return;

    // Anti-rebond : sans lui, chaque frappe déclenche un rendu serveur et
    // une requête base. 300 ms suffisent à ne plus le sentir.
    const minuteur = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (saisie.trim()) p.set("q", saisie.trim());
      else p.delete("q");

      const q = p.toString();
      // `replace` et non `push` : chaque lettre tapée n'a pas à devenir une
      // entrée d'historique qu'il faudrait dépiler une à une.
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }, 300);

    return () => clearTimeout(minuteur);
  }, [saisie, valeur, params, pathname, router]);

  return (
    <div className="relative">
      <IconeRecherche
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-encre-45"
      />
      <input
        ref={champ}
        type="search"
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        placeholder="Chercher un titre, un auteur, une série"
        enterKeyHint="search"
        aria-label="Chercher dans ma bibliothèque"
        className="w-full rounded-pilule bg-white/80 py-3 pr-10 pl-10 text-[15px] ring-1 ring-white/80 outline-none backdrop-blur-sm focus:bg-white focus:ring-2 focus:ring-dragee"
      />

      {saisie ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={RESSORT}
          onClick={() => {
            setSaisie("");
            champ.current?.focus();
          }}
          aria-label="Effacer la recherche"
          className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-pilule text-encre-45"
        >
          <IconeFermer className="h-4 w-4" />
        </motion.button>
      ) : null}
    </div>
  );
}
