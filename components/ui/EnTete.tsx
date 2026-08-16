import type { ReactNode } from "react";

/**
 * En-tête d'écran. Reste collé en haut de la zone défilable et absorbe la
 * marge d'encoche — sur iPhone, un titre placé sans ça passe sous l'heure.
 */
export function EnTete({
  titre,
  detail,
  action,
}: {
  titre: string;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-30 bg-velin/85 px-5 pb-3 backdrop-blur-xl"
      style={{ paddingTop: "calc(var(--marge-haut) + 1.25rem)" }}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight">
            {titre}
          </h1>
          {detail ? (
            <p className="chiffres mt-0.5 text-sm text-encre-45">{detail}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0 pb-1">{action}</div> : null}
      </div>
    </header>
  );
}

/** Message d'état vide. Propose toujours une action — jamais un cul-de-sac. */
export function EtatVide({
  titre,
  texte,
  action,
}: {
  titre: string;
  texte?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-5 mt-10 rounded-feuille border border-dashed border-encre-20 px-6 py-10 text-center">
      <p className="font-lecture text-lg text-encre">{titre}</p>
      {texte ? (
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-encre-45">
          {texte}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
