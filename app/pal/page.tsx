import { EnTete, EtatVide } from "@/components/ui/EnTete";

export default function Pal() {
  return (
    <>
      <EnTete titre="PAL" detail="Pile à lire" />
      <div className="px-5 pb-8">
        <EtatVide titre="Pile vide." />
      </div>
    </>
  );
}
