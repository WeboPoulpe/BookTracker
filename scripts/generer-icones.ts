/**
 * Génère les icônes PWA à partir d'un tracé SVG, pour ne pas versionner
 * de binaires qu'on ne saurait plus régénérer.
 *
 *   npx tsx scripts/generer-icones.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

const ENCRE = "#1B1A2E";
const VELIN = "#F4F1F7";
const DRAGEE = "#F2C4D8";
const SAUGE = "#BBD4C4";
const TRANCHE = "#A8C0E8";
const DORURE = "#E8B84B";

/**
 * Quatre tranches de livre de hauteurs inégales, vues de face.
 * `echelle` réduit le motif pour dégager la zone de sécurité maskable
 * (les lanceurs Android rognent jusqu'à 20 % de chaque bord).
 */
function svg(taille: number, echelle: number, fond: string) {
  const c = taille / 2;
  const u = taille * echelle;
  const x0 = c - u / 2;
  const y0 = c - u / 2;

  // largeur, hauteur relative, couleur
  const tranches: [number, number, string][] = [
    [0.17, 0.72, DRAGEE],
    [0.21, 0.94, VELIN],
    [0.15, 0.6, SAUGE],
    [0.2, 0.82, TRANCHE],
  ];

  const ecart = 0.055;
  const total =
    tranches.reduce((s, [l]) => s + l, 0) + ecart * (tranches.length - 1);
  let curseur = (1 - total) / 2;

  const rects = tranches
    .map(([largeur, hauteur, couleur]) => {
      const x = x0 + curseur * u;
      const h = hauteur * u * 0.9;
      const y = y0 + u * 0.95 - h;
      const w = largeur * u;
      curseur += largeur + ecart;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(w * 0.22).toFixed(1)}" fill="${couleur}"/>`;
    })
    .join("");

  // Liseré doré : le détail de reliure qui signe l'icône
  const liseréY = y0 + u * 0.95 + u * 0.035;
  const liseré = `<rect x="${(x0 + u * 0.06).toFixed(1)}" y="${liseréY.toFixed(1)}" width="${(u * 0.88).toFixed(1)}" height="${(u * 0.035).toFixed(1)}" rx="${(u * 0.018).toFixed(1)}" fill="${DORURE}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}">
  <rect width="${taille}" height="${taille}" fill="${fond}"/>
  ${rects}
  ${liseré}
</svg>`;
}

async function main() {
  const dossier = join(process.cwd(), "public", "icones");
  await mkdir(dossier, { recursive: true });

  const sorties: [string, number, number][] = [
    // nom, taille, échelle du motif
    ["192.png", 192, 0.68],
    ["512.png", 512, 0.68],
    ["maskable.png", 512, 0.52], // motif rétréci : zone de sécurité des lanceurs
    ["apple-touch-icon.png", 180, 0.68],
  ];

  for (const [nom, taille, echelle] of sorties) {
    const source = Buffer.from(svg(taille, echelle, ENCRE));
    await sharp(source).png().toFile(join(dossier, nom));
    console.log("✓", `public/icones/${nom}`);
  }

  // Favicon SVG — net à toutes les tailles, contrairement au .ico
  await writeFile(join(dossier, "favicon.svg"), svg(64, 0.72, ENCRE), "utf8");
  console.log("✓", "public/icones/favicon.svg");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
