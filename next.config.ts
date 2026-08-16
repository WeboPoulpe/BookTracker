import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Les deux sources de couvertures par ISBN. Les couvertures importées
      // à la main, elles, sont servies par /api/couverture.
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "https", hostname: "books.google.com" },
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
