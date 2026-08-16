import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Newsreader, Schibsted_Grotesk } from "next/font/google";

import { EtatReseau } from "@/components/EtatReseau";
import { TapBar } from "@/components/TapBar";
import { Decor } from "@/components/ui/Decor";

import "./globals.css";

/* Trois rôles typographiques, et une inversion assumée :
   le contenu (titres de livres, avis, citations) est en face de labeur,
   le chrome d'interface en grotesque. Dans une app sur les livres,
   c'est le contenu qui mérite une typo de livre. */

const display = Bricolage_Grotesque({
  variable: "--police-display",
  subsets: ["latin"],
  display: "swap",
});

const lecture = Newsreader({
  variable: "--police-lecture",
  subsets: ["latin"],
  display: "swap",
});

const ui = Schibsted_Grotesk({
  variable: "--police-ui",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ma Bibliothèque",
  description: "Suivi de lecture — séries, sessions, statistiques. Hors ligne.",
  applicationName: "Ma Bibliothèque",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Bibliothèque",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#FAF6F8",
  width: "device-width",
  initialScale: 1,
  // Sous les encoches : le fond s'étend, on gère les marges nous-mêmes
  viewportFit: "cover",
  // On ne bloque pas le zoom : ce serait un défaut d'accessibilité.
  // Le zoom parasite à la saisie est évité par le font-size 16px des champs.
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${display.variable} ${lecture.variable} ${ui.variable}`}>
      <body>
        <Decor />
        {/* Le shell ne défile jamais : seul <main> défile, comme dans une app native */}
        <div className="flex h-dvh flex-col overflow-hidden">
          <main className="zone-defilable relative flex-1">{children}</main>
          {/* Entre le contenu et la tapbar : visible sans recouvrir ni le
              titre de l'écran ni les cibles de navigation. */}
          <EtatReseau />
          <TapBar />
        </div>
      </body>
    </html>
  );
}
