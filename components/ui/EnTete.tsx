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
      className="sticky top-0 z-30 px-5 pb-4"
      style={{
        paddingTop: "calc(var(--marge-haut) + 1.5rem)",
        // Dégradé plutôt qu'un fond dépoli net : la coupure franche d'un
        // backdrop-blur trahit le bord de l'en-tête au défilement.
        background:
          "linear-gradient(180deg, var(--color-velin) 55%, transparent 100%)",
      }}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="titre-degrade font-display text-[2rem] leading-[1.1] font-bold">
            {titre}
          </h1>
          {detail ? (
            <p className="chiffres mt-1 text-[13.5px] font-medium text-encre-45">
              {detail}
            </p>
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
    <div className="mx-5 mt-6 rounded-feuille bg-white/60 px-6 py-10 text-center ring-1 ring-rose-poudre backdrop-blur-sm">
      <span aria-hidden="true" className="mb-3 block text-3xl">
        ✦
      </span>
      <p className="font-lecture text-[18px] leading-snug text-encre">{titre}</p>
      {texte ? (
        <p className="mx-auto mt-2 max-w-xs text-[13.5px] leading-relaxed text-encre-45">
          {texte}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Intertitre de section, en petites capitales espacées. */
export function Section({
  titre,
  children,
  action,
}: {
  titre: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-3 px-0.5">
        <h2 className="text-[11.5px] font-bold tracking-[0.14em] text-rose-fonce uppercase">
          {titre}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
