-- Fiches que les catalogues ne sauront pas compléter.
--
-- Guides non officiels, éditions confidentielles : ces livres revenaient en
-- tête de « Compléter les fiches » à chaque passe, dans une liste de tâches
-- qu'on ne pouvait jamais terminer. Rien ne distingue en base un livre
-- introuvable d'un livre pas encore cherché — c'est donc un choix explicite,
-- et réversible.
ALTER TABLE "livres" ADD COLUMN "ignorer_complement" boolean DEFAULT false;
