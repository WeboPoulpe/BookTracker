import { NextResponse } from "next/server";
import type { z } from "zod";

/** Réponse d'erreur uniforme — le client hors ligne s'appuie sur `code`. */
export function erreur(code: string, message: string, statut = 400) {
  return NextResponse.json({ erreur: { code, message } }, { status: statut });
}

/**
 * Parse et valide un corps JSON.
 *
 * Renvoie soit les données, soit une réponse prête à retourner : la route
 * n'a jamais à manipuler d'exception, ce qui évite les 500 sur une saisie
 * malformée rejouée depuis la file de synchro.
 */
export async function corpsValide<T extends z.ZodTypeAny>(
  requete: Request,
  schema: T,
): Promise<
  { ok: true; data: z.output<T> } | { ok: false; reponse: NextResponse }
> {
  let brut: unknown;
  try {
    brut = await requete.json();
  } catch {
    return { ok: false, reponse: erreur("json_invalide", "Corps illisible.") };
  }

  const r = schema.safeParse(brut);
  if (!r.success) {
    const premier = r.error.issues[0];
    return {
      ok: false,
      reponse: NextResponse.json(
        {
          erreur: {
            code: "validation",
            message: premier
              ? `${premier.path.join(".") || "champ"} : ${premier.message}`
              : "Données invalides.",
            details: r.error.issues,
          },
        },
        { status: 422 },
      ),
    };
  }

  return { ok: true, data: r.data };
}
