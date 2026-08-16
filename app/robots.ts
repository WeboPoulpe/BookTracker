import type { MetadataRoute } from "next";

/**
 * Bibliothèque personnelle : rien ici n'a vocation à être trouvé par un
 * moteur de recherche.
 *
 * C'est d'autant plus important tant que l'app tourne sans authentification :
 * les domaines .vercel.app se retrouvent dans les journaux publics de
 * transparence des certificats, et sont explorés depuis ces listes. Un
 * `noindex` n'est pas une protection, mais il évite que l'URL circule.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
