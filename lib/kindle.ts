/**
 * Parseur de `My Clippings.txt`, le fichier de surlignages des liseuses Kindle.
 *
 * Amazon n'expose aucune API de progression de lecture, et l'API Goodreads
 * est fermée. Ce fichier reste la seule voie stable : on branche la liseuse
 * en USB et on dépose le fichier. Rien à autoriser, rien qui casse au
 * prochain déploiement d'Amazon.
 *
 * Structure d'une entrée, séparées par une ligne de dix « = » :
 *
 *   Titre du livre (Nom, Prénom)
 *   - Votre surlignement Emplacement 1234-1236 | Ajouté le lundi 3 mars 2025…
 *   ‹ligne vide›
 *   Le texte du passage surligné
 *   ==========
 *
 * La deuxième ligne change de langue selon le réglage de la liseuse, d'où la
 * reconnaissance des variantes françaises et anglaises.
 */

import { normaliser } from "./texte";

export type Surlignage = {
  titre: string;
  auteur: string | null;
  texte: string;
  /** Numéro de page quand la liseuse le connaît — souvent absent */
  page: number | null;
  /** Emplacement Kindle, à défaut de page */
  emplacement: string | null;
  type: "surlignement" | "note";
};

export type AnalyseKindle = {
  surlignages: Surlignage[];
  /** Entrées écartées, avec leur motif */
  rejets: Array<{ apercu: string; motif: string }>;
  /** Titres distincts rencontrés, pour l'aperçu */
  livres: string[];
  total: number;
};

const SEPARATEUR = /^={5,}$/;

/** « Titre (Riley, Lucinda) » → titre et auteur remis dans l'ordre. */
export function separerTitreAuteur(ligne: string): {
  titre: string;
  auteur: string | null;
} {
  // Le BOM UTF-8 ouvre le fichier et colle au premier titre.
  const propre = ligne.replace(/^﻿/, "").trim();

  // La parenthèse d'auteur est la *dernière* : « Dune (tome 1) (Herbert, Frank) »
  const ouvrante = propre.lastIndexOf("(");
  if (ouvrante <= 0 || !propre.endsWith(")")) {
    return { titre: propre, auteur: null };
  }

  const titre = propre.slice(0, ouvrante).trim();
  const brut = propre.slice(ouvrante + 1, -1).trim();

  // Kindle écrit « Nom, Prénom » ; on rétablit l'ordre de lecture.
  const virgule = brut.indexOf(",");
  const auteur =
    virgule > 0
      ? `${brut.slice(virgule + 1).trim()} ${brut.slice(0, virgule).trim()}`.trim()
      : brut;

  return { titre: titre || propre, auteur: auteur || null };
}

/**
 * Lit la ligne de métadonnées : nature de l'entrée, page, emplacement.
 *
 * Les signets n'ont aucun texte : les reconnaître évite de les compter
 * comme des entrées vides à l'aperçu.
 */
export function lireMeta(ligne: string): {
  type: Surlignage["type"] | "signet" | "inconnu";
  page: number | null;
  emplacement: string | null;
} {
  const l = ligne.toLowerCase();

  const type = /surlignement|surlignage|highlight/.test(l)
    ? "surlignement"
    : /votre note|your note|note :/.test(l)
      ? "note"
      : /signet|bookmark/.test(l)
        ? "signet"
        : "inconnu";

  const page = l.match(/(?:page|à la page)\s+([\d]+)/)?.[1];
  const emplacement = l.match(
    /(?:emplacement|position|location)\s+([\d]+(?:-[\d]+)?)/,
  )?.[1];

  return {
    type,
    page: page ? Number.parseInt(page, 10) : null,
    emplacement: emplacement ?? null,
  };
}

export function analyserClippings(contenu: string): AnalyseKindle {
  // Les liseuses écrivent en CRLF ; certains transferts convertissent.
  const lignes = contenu.replace(/\r\n?/g, "\n").split("\n");

  const surlignages: Surlignage[] = [];
  const rejets: AnalyseKindle["rejets"] = [];
  const livres = new Set<string>();

  let bloc: string[] = [];
  let total = 0;

  const traiter = () => {
    // Une entrée vaut au moins : titre, métadonnées, texte.
    if (bloc.length === 0) return;
    total += 1;

    const [ligneTitre, ligneMeta, ...reste] = bloc;
    const apercu = (ligneTitre ?? "").slice(0, 60);

    const { titre, auteur } = separerTitreAuteur(ligneTitre ?? "");
    if (!titre) {
      rejets.push({ apercu, motif: "Titre illisible" });
      return;
    }

    const meta = lireMeta(ligneMeta ?? "");
    if (meta.type === "signet") {
      rejets.push({ apercu: titre, motif: "Signet, sans texte" });
      return;
    }

    const texte = reste.join("\n").trim();
    if (!texte) {
      rejets.push({ apercu: titre, motif: "Aucun texte" });
      return;
    }

    livres.add(titre);
    surlignages.push({
      titre,
      auteur,
      texte,
      page: meta.page,
      emplacement: meta.emplacement,
      type: meta.type === "note" ? "note" : "surlignement",
    });
  };

  for (const ligne of lignes) {
    if (SEPARATEUR.test(ligne.trim())) {
      traiter();
      bloc = [];
      continue;
    }
    // On ne coupe pas sur les lignes vides : un passage surligné peut en
    // contenir, et le découpage se fait sur le séparateur seul.
    if (bloc.length === 0 && ligne.trim() === "") continue;
    bloc.push(ligne);
  }
  traiter();

  return {
    surlignages,
    rejets,
    livres: [...livres].sort((a, b) => a.localeCompare(b, "fr")),
    total,
  };
}

/**
 * Dédoublonne les surlignages d'un même passage.
 *
 * Étendre une sélection sur la liseuse réenregistre le passage entier : le
 * fichier contient alors la version courte *et* la version longue. On garde
 * la plus longue, celle que la lectrice a finalement retenue.
 */
export function dedoublonner(surlignages: Surlignage[]): Surlignage[] {
  const gardes: Array<{ s: Surlignage; noyau: string }> = [];

  for (const s of surlignages) {
    // Réduit à ses mots : en étendant une sélection, la liseuse remplace la
    // ponctuation finale, et « …les mots. » devient « …les mots, et… ».
    const n = normaliser(s.texte);
    // Inclusion et non préfixe : une sélection s'étend aussi vers la gauche.
    const doublon = gardes.findIndex(
      (g) =>
        g.s.titre === s.titre &&
        (g.noyau.includes(n) || n.includes(g.noyau)),
    );

    if (doublon === -1) {
      gardes.push({ s, noyau: n });
      continue;
    }
    if (n.length > gardes[doublon].noyau.length) gardes[doublon] = { s, noyau: n };
  }

  return gardes.map((g) => g.s);
}
