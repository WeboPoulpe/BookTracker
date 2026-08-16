import { EnTete, EtatVide } from "@/components/ui/EnTete";

export default function TableauDeBord() {
  return (
    <>
      <EnTete titre="Ma Bibliothèque" detail="Tableau de bord" />
      <div className="px-5 pb-8">
        <EtatVide
          titre="Rien à afficher pour l'instant."
          texte="Le tableau de bord se remplira dès les premiers livres importés."
        />
      </div>
    </>
  );
}
