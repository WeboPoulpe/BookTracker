import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next charge .env.local automatiquement, drizzle-kit non.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
