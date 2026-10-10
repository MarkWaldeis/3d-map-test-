// Terrain: Höhenfeld, Farbtextur (Gras/Sand/Wege/Fels), Insel-Unterseite
import * as THREE from 'three';
import { WORLD, ZONES, RIVER, CHANNEL, PATHS } from './layout.js';

// ---------- deterministisches Rauschen ----------
function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, oct = 3) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * vnoise(x * f, z * f); amp *= 0.5; f *= 2.03; }
  return v; // ~0..1
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gauss = (x, z, cx, cz, s) => Math.exp(-(((x - cx) ** 2) + ((z - cz) ** 2)) / (2 * s * s));
const lerp = (a, b, t) => a + (b - a) * t;

// Küstenradius in Richtung theta (mit Bucht im SO und Burgkanal im O)
export function coastRadius(theta) {
  let r = WORLD.islandRadius * (1 + 0.10 * (fbm(Math.cos(theta) * 1.7 + 5, Math.sin(theta) * 1.7 + 5) - 0.5)
    + 0.05 * Math.sin(theta * 3 + 1.2));
  // Bucht Süd-Ost (~theta 55-75°)
  const bayA = Math.atan2(24, 24); // ~45° in atan2(z,x)
  const dBay = Math.abs(THREE.MathUtils.euclideanModulo(theta - bayA + Math.PI, Math.PI * 2) - Math.PI);
  r *= 1 - 0.30 * Math.exp(-(dBay * dBay) / (2 * 0.28 * 0.28));
  // Burgkanal Ost (~theta -18°): Meeresarm zwischen Hauptinsel und Burgfelsen
  const chA = Math.atan2(-9, 32);
  const dCh = Math.abs(THREE.MathUtils.euclideanModulo(theta - chA + Math.PI, Math.PI * 2) - Math.PI);
  r *= 1 - 0.16 * Math.exp(-(dCh * dCh) / (2 * 0.14 * 0.14));
  return r;
}

function distToPolyline(x, z, pts) {
  let m = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const px = ax + dx * t, pz = az + dz * t;
    m = Math.min(m, Math.hypot(x - px, z - pz));
  }
  return m;
}
export function riverDist(x, z) { return distToPolyline(x, z, RIVER.pts); }
export function channelDist(x, z) { return distToPolyline(x, z, CHANNEL.pts); }
export function pathDist(x, z) {
  let m = 1e9;
  for (const p of PATHS) m = Math.min(m, distToPolyline(x, z, p));
  return m;
}

// ---------- Höhenfunktion ----------
export function heightAt(x, z) {
  const dC = Math.hypot(x, z);
  const theta = Math.atan2(z, x);
  const R = coastRadius(theta);
  const d = dC / R;

  // Insel-Plateau mit Felsrand
  let h;
  if (d < 0.97) {
    h = 2.9 * (1 - 0.18 * d * d);
    h += 0.55 * (fbm(x * 0.045 + 3, z * 0.045) - 0.5) * 2; // Wiesen-Variation
    // Felsrand leicht ansteigend
    h += 1.6 * sstep(0.86, 0.99, d);
  } else {
    // Klippe -> Meeresboden
    h = lerp(3.6, -9, sstep(0.97, 1.18, d)) - Math.max(0, (d - 1.18)) * 12;
  }

  // Windmühlen-Hügel NW
  h += 3.0 * gauss(x, z, -26, -9, 11);
  // Nordkamm (unter den Bergen)
  h += 5.5 * gauss(x, z, -14, -26, 10) + 6.5 * gauss(x, z, 4, -29, 11) + 4.5 * gauss(x, z, 17, -23, 9);
  // Sanfte Ostwiese hinterm Dorf
  h += 1.4 * gauss(x, z, 18, -12, 9);

  // Burgfelsen-Inselchen (eigener Sockel)
  const dI = Math.hypot(x - ZONES.castleIslet.x, z - ZONES.castleIslet.z) / ZONES.castleIslet.r;
  if (dI < 1.15) {
    const hi = dI < 0.92 ? 5.4 * (1 - 0.1 * dI) : lerp(4.9, -8, sstep(0.92, 1.15, dI));
    h = Math.max(h, hi);
  }

  // See-Mulde (belirgin havza — sırt sızıntısını bastıracak kadar derin)
  h -= 7.6 * gauss(x, z, ZONES.lake.x, ZONES.lake.z, 10.5);

  // Dorfplatz + Dorf flach
  const dv = Math.hypot(x - ZONES.village.x, z - ZONES.village.z);
  h = lerp(h, 2.65, sstep(14, 7, dv) * 0.9);
  // Felder flach
  const df = Math.hypot(x - ZONES.fields.x, z - ZONES.fields.z);
  h = lerp(h, 2.4, sstep(13, 8, df) * 0.85);
  // Strand flach Richtung Wasser
  const db = Math.hypot(x - ZONES.beach.x, z - ZONES.beach.z);
  h = lerp(h, 0.55, sstep(9, 5, db) * 0.9);

  // Flussbett EN SON — düzleştirmelerin üstünden gerçek kanalı keser
  const rd = riverDist(x, z);
  h -= 2.6 * Math.exp(-(rd * rd) / (2 * 2.6 * 2.6));

  // Burgkanal: Meeresarm vor dem Inselchen — schneidet bis knapp an den Sockel
  const dIsl = Math.hypot(x - ZONES.castleIslet.x, z - ZONES.castleIslet.z) / ZONES.castleIslet.r;
  if (dIsl > 0.42) {
    const cd = channelDist(x, z);
    h -= 6.5 * Math.exp(-(cd * cd) / (2 * 5.0 * 5.0));
  }

  return h;
}

// Steigung (für Felsfarbe / Platzierungs-Checks)
export function slopeAt(x, z, e = 0.6) {
  const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
  const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  return Math.hypot(dx, dz);
}

// ---------- Farbtextur ----------
function paintColormap(size = 1024) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const W = WORLD.size;
  const toPx = (x, z) => [(x / W + 0.5) * size, (z / W + 0.5) * size];
  const img = g.createImageData(size, size);
  const px = img.data;

  const grass = [110, 174, 62], grass2 = [126, 188, 74], dryGrass = [148, 186, 80];
  const sand = [232, 211, 138], wetSand = [205, 184, 122];
  const rock = [124, 106, 85], rockDark = [96, 82, 66];
  const dirt = [178, 138, 90], deep = [28, 74, 96], shallow = [64, 130, 150];

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i / size - 0.5) * W, z = (j / size - 0.5) * W;
      const h = heightAt(x, z);
      const sl = slopeAt(x, z);
      const n = fbm(x * 0.09 + 9, z * 0.09);
      let r, gg, b;

      if (h < -1.5) {
        // Meeresboden
        const t = sstep(-1.5, -8, h);
        r = lerp(shallow[0], deep[0], t); gg = lerp(shallow[1], deep[1], t); b = lerp(shallow[2], deep[2], t);
      } else if (h < 0.35) {
        // Wasserlinie / nasser Sand
        r = wetSand[0]; gg = wetSand[1]; b = wetSand[2];
      } else if (h < 1.1 && (z > 10 || Math.hypot(x - ZONES.beach.x, z - ZONES.beach.z) < ZONES.beach.r + 2)) {
        r = sand[0]; gg = sand[1]; b = sand[2];
      } else {
        // Gras mit Zonenvariation
        const t = n;
        r = lerp(grass[0], grass2[0], t); gg = lerp(grass[1], grass2[1], t); b = lerp(grass[2], grass2[2], t);
        if (fbm(x * 0.05, z * 0.05 + 40) > 0.62) { r = lerp(r, dryGrass[0], 0.5); gg = lerp(gg, dryGrass[1], 0.5); b = lerp(b, dryGrass[2], 0.5); }
        // Wald dunkler
        if ((x > ZONES.forestWest.x0 && x < ZONES.forestWest.x1 && z > ZONES.forestWest.z0 && z < ZONES.forestWest.z1) ||
            (x > ZONES.forestNorth.x0 && x < ZONES.forestNorth.x1 && z > ZONES.forestNorth.z0 && z < ZONES.forestNorth.z1)) {
          r *= 0.88; gg *= 0.9; b *= 0.88;
        }
        // Höhe -> alpiner/grauer Ton oben am Kamm
        if (h > 6) { const t2 = sstep(6, 10, h) * 0.7; r = lerp(r, 150, t2); gg = lerp(gg, 148, t2); b = lerp(b, 140, t2); }
      }
      // steile Flanken -> Fels
      if (sl > 0.55 && h > -0.5) {
        const t = Math.min(1, (sl - 0.55) / 0.6);
        const rk = n > 0.5 ? rock : rockDark;
        r = lerp(r, rk[0], t); gg = lerp(gg, rk[1], t); b = lerp(b, rk[2], t);
      }
      // Wege
      const pd = pathDist(x, z);
      if (pd < 1.5 && h > 0.5) {
        const t = 1 - sstep(0.7, 1.5, pd);
        r = lerp(r, dirt[0], t * 0.85); gg = lerp(gg, dirt[1], t * 0.85); b = lerp(b, dirt[2], t * 0.85);
      }
      // Flussbett + Burgkanal: dunkler Sand unter Wasser
      const rd = riverDist(x, z), cd = channelDist(x, z);
      if ((rd < 2.6 || cd < 3.4) && h < 1.2) { r = lerp(r, wetSand[0], 0.6); gg = lerp(gg, wetSand[1], 0.6); b = lerp(b, wetSand[2], 0.6); }

      const k = (j * size + i) * 4;
      px[k] = r; px[k + 1] = gg; px[k + 2] = b; px[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---------- Meshes ----------
export function buildTerrain(quality = 'high') {
  const seg = quality === 'low' ? 140 : 210;
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: paintColormap(1024),
    roughness: 0.96,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';

  // Felsige Unterseite (unter Wasserlinie sichtbarer Zipfel)
  const underside = buildUnderside();
  return [mesh, underside];
}

function buildUnderside() {
  const th0 = Math.PI * 0.55, th1 = Math.PI * 0.98; // Sektor Südwest (Bild links unten)
  const radial = 14, rings = 6, pts = [];
  const geo = new THREE.BufferGeometry();
  const verts = [], idx = [];
  for (let ri = 0; ri <= rings; ri++) {
    const f = ri / rings;
    const y = -1.2 - f * 14;
    const shrink = 1 - f * 0.85;
    for (let ai = 0; ai <= radial; ai++) {
      const th = th0 + (th1 - th0) * (ai / radial);
      const rr = coastRadius(th) * 0.9 * shrink * (0.9 + 0.25 * fbm(Math.cos(th) * 3, ri * 1.7));
      verts.push(Math.cos(th) * rr, y + 1.5 * fbm(th * 4, ri * 2.2), Math.sin(th) * rr);
    }
  }
  for (let ri = 0; ri < rings; ri++) {
    for (let ai = 0; ai < radial; ai++) {
      const a = ri * (radial + 1) + ai, b = a + 1, c = a + radial + 1, d2 = c + 1;
      idx.push(a, c, b, b, c, d2);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6e5c48, roughness: 1, flatShading: true });
  const m = new THREE.Mesh(geo, mat);
  m.name = 'underside';
  return m;
}
