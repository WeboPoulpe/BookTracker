/**
 * Décor de fond : deux halos qui dérivent lentement, et quelques éclats.
 *
 * Purement CSS, donc rendu côté serveur et sans coût JavaScript. Le mouvement
 * est très lent (22 s) et de faible amplitude : perceptible quand on s'arrête
 * sur un écran, invisible quand on navigue — c'est ce qui donne l'impression
 * d'une surface vivante sans jamais capter l'attention.
 */
export function Decor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="decor-derive absolute -top-24 -left-20 h-72 w-72 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgb(242 196 216 / 0.55) 0%, transparent 70%)",
        }}
      />
      <div
        className="decor-derive absolute top-1/3 -right-24 h-80 w-80 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgb(236 228 245 / 0.7) 0%, transparent 70%)",
          animationDelay: "-8s",
        }}
      />
      <div
        className="decor-derive absolute bottom-0 left-1/4 h-64 w-64 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgb(187 212 196 / 0.4) 0%, transparent 70%)",
          animationDelay: "-15s",
        }}
      />

      {/* Éclats — la touche de dorure du §7, réduite à sa plus simple expression */}
      {[
        { top: "12%", left: "8%", d: "0s", t: 5 },
        { top: "26%", right: "14%", d: "-1.2s", t: 4 },
        { top: "62%", left: "12%", d: "-2.4s", t: 4 },
        { top: "78%", right: "18%", d: "-0.6s", t: 5 },
      ].map((e, i) => (
        <span
          key={i}
          className="decor-scintille absolute"
          style={{
            top: e.top,
            left: e.left,
            right: e.right,
            animationDelay: e.d,
          }}
        >
          <svg width={e.t * 2.4} height={e.t * 2.4} viewBox="0 0 24 24">
            <path
              d="M12 0c.6 6.3 5.1 10.8 12 12-6.9 1.2-11.4 5.7-12 12-.6-6.3-5.1-10.8-12-12C6.9 10.8 11.4 6.3 12 0Z"
              fill="rgb(224 168 60 / 0.55)"
            />
          </svg>
        </span>
      ))}
    </div>
  );
}
