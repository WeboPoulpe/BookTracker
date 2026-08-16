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

export default nextConfig;
