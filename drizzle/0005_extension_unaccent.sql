-- Recherche insensible aux accents et aux ligatures.
--
-- ILIKE replie la casse, rien de plus : « soeur » ne trouvait pas « Les Sept
-- Sœurs », et « etranger » manquait « L'Étranger ». Or c'est exactement ainsi
-- qu'on tape le titre d'un livre qu'on cherche — sans ressortir les accents.
--
-- Le dictionnaire livré avec unaccent traite les deux cas d'un coup, œ → oe
-- compris, là où un TRANSLATE ne sait pas remplacer un caractère par deux.
CREATE EXTENSION IF NOT EXISTS unaccent;
