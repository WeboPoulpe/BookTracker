import { EnTete, EtatVide } from "@/components/ui/EnTete";

export default function Etagere() {
  return (
    <>
      <EnTete titre="Étagère" detail="0 livre" />
      <div className="px-5 pb-8">
        <EtatVide titre="L'étagère est vide." />
      </div>
    </>
  );
}
