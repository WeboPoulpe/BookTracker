import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquant — vérifie .env.local");
}

/**
 * Driver HTTP, pas un pool `pg`.
 *
 * En serverless, un pool persistant épuise les connexions Neon : chaque
 * invocation de fonction en ouvrirait un nouveau sans jamais le fermer.
 * `neon-http` fait une requête HTTP par appel, sans état — c'est aussi la
 * seule variante compatible avec l'edge runtime.
 */
export const db = drizzle(neon(process.env.DATABASE_URL), { schema });

export { schema };
