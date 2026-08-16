/**
 * Référentiel de notation, partagé serveur et client.
 *
 * Volontairement hors de components/Notation.tsx : ce fichier porte la
 * directive "use client", et une constante qui en est exportée arrive dans un
 * composant serveur sous forme de référence client, pas de valeur. `AXES.map`
 * y échoue alors avec « is not a function ». Les données partagées vivent
 * donc dans un module neutre.
 */

export const AXES = [
  { cle: "axeIntrigue", libelle: "Intrigue", aide: "Rythme, construction" },
  { cle: "axePersonnages", libelle: "Personnages", aide: "Profondeur, attachement" },
  { cle: "axeEmotion", libelle: "Émotion", aide: "Ce qu'il a remué" },
  { cle: "axeThemes", libelle: "Thèmes", aide: "Richesse du propos" },
] as const;

export type CleAxe = (typeof AXES)[number]["cle"];

/**
 * Humeurs post-lecture : un mot et un emoji (§2).
 *
 * Liste fermée plutôt que saisie libre : on veut pouvoir compter les coups
 * de cœur d'une année, ce qu'une saisie libre rendrait impossible — « coup
 * de coeur », « Coup de cœur » et « ❤️ » deviendraient trois humeurs.
 */
export const HUMEURS = [
  { emoji: "😍", mot: "Coup de cœur" },
  { emoji: "🥹", mot: "Bouleversant" },
  { emoji: "😭", mot: "Déchirant" },
  { emoji: "😱", mot: "Haletant" },
  { emoji: "🤯", mot: "Vertigineux" },
  { emoji: "🥰", mot: "Doux" },
  { emoji: "😌", mot: "Apaisant" },
  { emoji: "🤔", mot: "Troublant" },
  { emoji: "😏", mot: "Savoureux" },
  { emoji: "🫠", mot: "Addictif" },
  { emoji: "😐", mot: "Tiède" },
  { emoji: "🥱", mot: "Laborieux" },
  { emoji: "😤", mot: "Agaçant" },
  { emoji: "💔", mot: "Décevant" },
] as const;
