import Link from "next/link";

import { ImportKindle } from "@/components/ImportKindle";
import { IconeRetour } from "@/components/ui/Icones";

export const metadata = { title: "Surlignages Kindle · Ma Bibliothèque" };

export default function KindlePage() {
  return (
    <>
      <div
        className="sticky top-0 z-30 px-5 pb-2"
        style={{
          paddingTop: "calc(var(--marge-haut) + 0.75rem)",
          background:
            "linear-gradient(180deg, var(--color-velin) 60%, transparent 100%)",
        }}
      >
        <Link
          href="/reglages"
          className="-ml-1.5 inline-flex min-h-[44px] items-center gap-1 text-[15px] font-medium text-encre-70"
        >
          <IconeRetour className="h-5 w-5" />
          Réglages
        </Link>
        <h1 className="mt-1 font-display text-[1.75rem] leading-tight font-semibold">
          Surlignages Kindle
        </h1>
      </div>
      <ImportKindle />
    </>
  );
}
