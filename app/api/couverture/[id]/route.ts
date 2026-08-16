import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { couvertures } from "@/db/schema";

type Contexte = { params: Promise<{ id: string }> };

/**
 * Sert une couverture importée.
 *
 * Route publique volontairement : `next/image` et le service worker la
 * chargent comme n'importe quelle image, sans en-tête d'authentification.
 * Elle ne révèle qu'une couverture de livre, contre un identifiant numérique
 * — et l'app entière est déjà sans authentification (cf. README).
 */
export async function GET(requete: Request, ctx: Contexte) {
  const { id } = await ctx.params;
  const n = Number.parseInt(id, 10);
  if (!Number.isInteger(n) || n <= 0) {
    return NextResponse.json({ erreur: "id invalide" }, { status: 400 });
  }

  try {
    const [c] = await db
      .select()
      .from(couvertures)
      .where(eq(couvertures.livreId, n))
      .limit(1);

    if (!c) return new NextResponse(null, { status: 404 });

    const etag = `"${c.version}"`;

    // 304 si le navigateur a déjà la bonne version : on évite de relire des
    // dizaines de kilo-octets en base à chaque affichage de la grille.
    if (requete.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    const binaire = Buffer.from(c.donnees, "base64");

    return new NextResponse(new Uint8Array(binaire), {
      headers: {
        "Content-Type": c.type,
        "Content-Length": String(binaire.byteLength),
        ETag: etag,
        // `immutable` est sûr ici : l'URL porte la version, un remplacement
        // produit donc une autre URL.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("GET /api/couverture/[id]", e);
    return new NextResponse(null, { status: 500 });
  }
}
