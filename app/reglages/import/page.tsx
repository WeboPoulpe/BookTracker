import Link from "next/link";

import { ImportGoodreads } from "@/components/ImportGoodreads";
import { IconeRetour } from "@/components/ui/Icones";

export const metadata = { title: "Importer · Ma Bibliothèque" };

export default function ImportPage() {
  return (
    <>
      <div
        className="sticky top-0 z-30 bg-velin/85 px-5 pb-2 backdrop-blur-xl"
        style={{ paddingTop: "calc(var(--marge-haut) + 0.75rem)" }}
      >
        <Link
          href="/reglages"
          className="-ml-1.5 inline-flex min-h-[44px] items-center gap-1 text-[15px] text-encre-70"
        >
          <IconeRetour className="h-5 w-5" />
          Réglages
        </Link>
        <h1 className="mt-1 font-display text-[1.75rem] font-semibold leading-tight">
          Importer Goodreads
        </h1>
      </div>
      <ImportGoodreads />
    </>
  );
}
