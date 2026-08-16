import { Pal } from "@/components/Pal";
import { BoutonLien } from "@/components/ui/Bouton";
import { EnTete, EtatVide } from "@/components/ui/EnTete";
import { listerLivres } from "@/db/requetes/livres";
import { pluriel } from "@/lib/format";
import { utilisateurCourantId } from "@/lib/utilisateur";

export const dynamic = "force-dynamic";
export const metadata = { title: "PAL · Ma Bibliothèque" };

export default async function PalPage() {
  const utilisateurId = await utilisateurCourantId();
  const livres = await listerLivres(utilisateurId, {
    statut: "a_lire",
    tri: "recent",
  });

  return (
    <>
      <EnTete titre="PAL" detail={pluriel(livres.length, "livre à lire")} />

      {livres.length === 0 ? (
        <EtatVide
          titre="Pile vide."
          texte="Les livres au statut « à lire » atterrissent ici, à trier entre Envie, Bientôt et Suivant."
          action={
            <BoutonLien href="/bibliotheque/ajouter" taille="sm">
              Ajouter un livre
            </BoutonLien>
          }
        />
      ) : (
        <Pal livres={livres} />
      )}
    </>
  );
}
