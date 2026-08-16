import { AjoutLivre } from "@/components/AjoutLivre";
import { EnTete } from "@/components/ui/EnTete";

export const metadata = { title: "Ajouter un livre · Ma Bibliothèque" };

export default function AjouterPage() {
  return (
    <>
      <EnTete titre="Ajouter un livre" detail="Recherche Open Library" />
      <AjoutLivre />
    </>
  );
}
