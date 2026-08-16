import { BoutonLien } from "@/components/ui/Bouton";
import { EnTete } from "@/components/ui/EnTete";

export const metadata = { title: "Hors ligne · Ma Bibliothèque" };

/**
 * Repli servi par le service worker quand une page n'a jamais été visitée
 * et que le réseau manque. Les pages déjà ouvertes, elles, sortent du cache.
 */
export default function HorsLigne() {
  return (
    <>
      <EnTete titre="Hors ligne" />
      <div className="px-5 pt-2 pb-10">
        <div className="carte p-5">
          <p className="font-lecture text-[17px] leading-relaxed">
            Cette page n&apos;a pas encore été ouverte sur cet appareil, elle
            n&apos;est donc pas en cache.
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-encre-45">
            Les écrans déjà visités restent consultables, et tout ce que tu
            saisis est mis en file : rien ne sera perdu au retour du réseau.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <BoutonLien href="/" taille="lg">
            Retour à l&apos;accueil
          </BoutonLien>
          <BoutonLien href="/bibliotheque" taille="lg" variante="doux">
            Ma bibliothèque
          </BoutonLien>
        </div>
      </div>
    </>
  );
}
