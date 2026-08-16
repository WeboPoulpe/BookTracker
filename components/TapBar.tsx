"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  IconeAccueil,
  IconeBibliotheque,
  IconeEtagere,
  IconePal,
  IconeReglages,
} from "@/components/ui/Icones";

type Onglet = {
  href: string;
  libelle: string;
  Icone: React.ComponentType<{ actif?: boolean; className?: string }>;
  /** Routes annexes qui doivent garder cet onglet allumé */
  englobe?: string[];
};

const ONGLETS: Onglet[] = [
  { href: "/", libelle: "Accueil", Icone: IconeAccueil },
  {
    href: "/bibliotheque",
    libelle: "Bibliothèque",
    Icone: IconeBibliotheque,
    // Séries et citations sont des segments de la bibliothèque, pas des onglets :
    // au-delà de cinq cibles, la barre devient illisible au pouce.
    englobe: ["/series", "/citations"],
  },
  { href: "/etagere", libelle: "Étagère", Icone: IconeEtagere },
  { href: "/pal", libelle: "PAL", Icone: IconePal },
  { href: "/reglages", libelle: "Réglages", Icone: IconeReglages },
];

function estActif(pathname: string, onglet: Onglet) {
  if (onglet.href === "/") return pathname === "/";
  const cibles = [onglet.href, ...(onglet.englobe ?? [])];
  return cibles.some((c) => pathname === c || pathname.startsWith(`${c}/`));
}

export function TapBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="relative z-40 shrink-0 border-t border-bordure bg-papier/85 backdrop-blur-xl"
      style={{ paddingBottom: "var(--marge-bas)" }}
    >
      <ul className="flex h-[var(--h-tapbar)] items-stretch">
        {ONGLETS.map((onglet) => {
          const actif = estActif(pathname, onglet);
          const { Icone } = onglet;

          return (
            <li key={onglet.href} className="flex-1">
              <Link
                href={onglet.href}
                aria-current={actif ? "page" : undefined}
                className={`group flex h-full flex-col items-center justify-center gap-[3px] transition-colors duration-150 ${
                  actif ? "text-encre" : "text-encre-45"
                }`}
              >
                <span className="relative flex items-center justify-center">
                  {/* Pastille d'état actif — dragée, discrète, derrière l'icône */}
                  <span
                    aria-hidden="true"
                    className={`absolute h-8 w-12 rounded-pilule bg-dragee transition-all duration-200 ${
                      actif ? "scale-100 opacity-100" : "scale-75 opacity-0"
                    }`}
                  />
                  <Icone actif={actif} className="relative h-[22px] w-[22px]" />
                </span>
                <span
                  className={`text-[10.5px] leading-none tracking-tight transition-[font-weight] ${
                    actif ? "font-semibold" : "font-medium"
                  }`}
                >
                  {onglet.libelle}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
