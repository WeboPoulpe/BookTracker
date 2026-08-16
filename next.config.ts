import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Seule source de couvertures distantes. Les couvertures importées
      // manuellement passeront par un blob, pas par un domaine tiers.
      { protocol: "https", hostname: "covers.openlibrary.org" },
    ],
    // Les couvertures ne changent jamais : un an de cache navigateur
    minimumCacheTTL: 31_536_000,
  },
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Le service worker intercepterait le rechargement à chaud et servirait
  // des pages périmées à chaque édition. On le réserve à la production.
  disable: process.env.NODE_ENV === "development",
  // Met en cache les routes visitées via next/link, pas seulement celles
  // ouvertes directement. C'est ce qui rend le mode avion utilisable.
  cacheOnNavigation: true,
  reloadOnOnline: false,
});

export default withSerwist(nextConfig);
