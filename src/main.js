// Schwebende Insel — Hauptmodul: Renderer, Kamera, Licht, Himmel, Loop
import * as THREE from 'three';
import { OrbitControls } from '../vendor/controls/OrbitControls.js';
import { WORLD } from './layout.js';
import { buildTerrain, fbm, heightAt } from './terrain.js';
import { buildSea, buildFoam, buildLake, buildRiver, buildWaterfall, buildFountainWater, tickWater } from './water.js';
import { loadAll, buildAssets, shrinkGLTF } from './assets.js';
import { Player } from './player.js';

const params = new URLSearchParams(location.search);
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
const isMobile = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
const QUALITY = params.get('quality') || (isMobile ? 'low' : 'high');

// ---------- Renderer / Szene ----------
const canvas = document.getElementById('c');
// Low: kein MSAA + niedrige PixelRatio — iOS-Safari stürzt sonst am Speicher ab
const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY !== 'low', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY === 'low' ? (isIOS ? 1.25 : 1.6) : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = QUALITY !== 'low';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3ee);
scene.fog = new THREE.Fog(0xbfe3ee, 150, 330);

// ---------- Kamera (Referenz-Ansicht: ISO-artig von Süden) ----------
const camera = new THREE.PerspectiveCamera(23, innerWidth / innerHeight, 0.5, 600);
const CAMS = {
  ref:     { pos: [14, 104, 150], tgt: [3, -3, -13] },
  top:     { pos: [0, 175, 6], tgt: [0, 0, 0] },
  iso:     { pos: [70, 55, 70], tgt: [0, 0, 0] },
  north:   { pos: [0, 35, -85], tgt: [0, 4, 0] },
  village: { pos: [12, 18, 30], tgt: [2, 3, 4] },
  castle:  { pos: [52, 26, 26], tgt: [29, 10, -9] },
  bay:     { pos: [24, 20, 52], tgt: [14, 2, 20] },
  forest:  { pos: [-52, 24, 30], tgt: [-26, 4, -4] },
  low:     { pos: [55, 8, 55], tgt: [0, 6, 0] },
  river:   { pos: [4, 26, 38], tgt: [-7, 0, 8] },
  channel: { pos: [36, 14, 14], tgt: [24, 3, -9] },
};
function setCam(name) {
  const c = CAMS[name] || CAMS.ref;
  camera.position.set(...c.pos);
  controls.target.set(...c.tgt);
  controls.update();
}
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 30;
controls.maxDistance = 240;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = 1.42;
controls.target.set(0, 0, -6);

// ---------- Licht ----------
const hemi = new THREE.HemisphereLight(0xf0f9ff, 0x9ab26e, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 2.35);
sun.position.set(-40, 70, -30);          // von NW -> Schatten Richtung SO wie im Bild
sun.castShadow = QUALITY !== 'low';
if (sun.castShadow) {
  sun.shadow.mapSize.set(2048, 2048);
  const c = 60;
  sun.shadow.camera.left = -c; sun.shadow.camera.right = c;
  sun.shadow.camera.top = c; sun.shadow.camera.bottom = -c;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 180;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
}
scene.add(sun);
const fill = new THREE.DirectionalLight(0xd8ecff, 0.5);
fill.position.set(50, 30, 60);
scene.add(fill);

// ---------- Welt ----------
const world = new THREE.Group();
scene.add(world);

for (const t of buildTerrain(QUALITY)) world.add(t);
world.add(buildSea());
world.add(buildFoam());
world.add(buildLake());
world.add(buildRiver(heightAt));
const waterfall = buildWaterfall(heightAt);
world.add(waterfall);
world.add(buildFountainWater(heightAt));

// Wolken: weiche Sprites um die Insel + drunter
function cloudTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = 20 + Math.random() * 88, y = 45 + Math.random() * 40, r = 12 + Math.random() * 20;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.85)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const cloudTex = cloudTexture();
const clouds = [];
{
  const n = QUALITY === 'low' ? 8 : 14;
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5 + Math.random() * 0.3, depthWrite: false });
    const s = new THREE.Sprite(m);
    const th = Math.random() * Math.PI * 2, r = 58 + Math.random() * 60;
    s.position.set(Math.cos(th) * r, -6 + Math.random() * 14, Math.sin(th) * r);
    const sc = 20 + Math.random() * 26;
    s.scale.set(sc, sc * 0.55, 1);
    clouds.push({ s, speed: 0.4 + Math.random() * 0.8 });
    world.add(s);
  }
}

// Vögel oben links (wie im Referenzbild)
const birds = [];
{
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0, 0.18, 0, 0.5, 0, 0], 3));
  const m = new THREE.MeshBasicMaterial({ color: 0x33424e, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(g, m);
    b.scale.setScalar(0.9 + Math.random() * 0.7);
    birds.push({ b, r: 8 + i * 3.2, ph: i * 1.9, h: 26 + (i % 3) * 3 });
    world.add(b);
  }
}

// ---------- Assets ----------
const GLB_FILES = [
  'barn_thatched.glb','barrels_crates.glb','bridge_stone.glb','bridge_wood.glb','castle.glb',
  'cliff_rock_castle.glb','crystal_blue_ruins.glb','crystal_purple.glb','fence_wood.glb',
  'field_vegetable.glb','field_wheat.glb','flower_bush.glb','fountain_dry.glb','house_blue_roof.glb',
  'house_chimney.glb','house_red_roof.glb','lamp_post.glb','mountain_snowy_cave.glb','pier_wood.glb',
  'plaza_cobblestone_tile.glb','rock_boulder.glb','rowboat.glb','sailboat.glb','shed_wood.glb',
  'signpost.glb','tree_autumn.glb','tree_pine.glb','tree_round.glb','windmill.glb',
];

const loaderEl = document.getElementById('loader');
const loaderTextEl = document.getElementById('loaderText');
const barEl = document.getElementById('bar');
let dynamic = null;
loadAll(GLB_FILES, (n, total) => {
  loaderTextEl.textContent = `Lade Insel … ${n}/${total}`;
  barEl.style.width = `${(n / total) * 100}%`;
}, QUALITY === 'low' ? g => shrinkGLTF(g, isIOS ? 384 : 512) : null).then(() => {
  dynamic = buildAssets(world, QUALITY !== 'low');
  loaderEl.style.display = 'none';
  document.body.dataset.ready = '1';
}).catch(err => {
  loaderTextEl.textContent = 'Fehler beim Laden: ' + err;
  console.error(err);
});

// ---------- Charakter-Modus ----------
const player = new Player();
window.__player = player;   // Debug-Hook
let walkMode = false, camRestoring = null;
const toast = (msg, ms = 2200) => {
  const el = document.getElementById('toast');
  el.textContent = msg; el.style.display = msg ? 'block' : 'none';
  if (msg && ms) setTimeout(() => { el.style.display = 'none'; }, ms);
};
async function enterWalkMode() {
  if (!player.ready) {
    toast('Lade Ritter …', 0);
    player._stage = (s) => toast('Ritter: ' + s, 0);
    try { await player.load(QUALITY); } catch (e) { toast('Charakter-Fehler: ' + e, 4000); return; }
    toast('');
    if (params.get('charpos')) {
      const [px, pz] = params.get('charpos').split(',').map(Number);
      if (isFinite(px) && isFinite(pz)) { player.pos.x = px; player.pos.z = pz; }
    }
    player.bindInput(document.getElementById('joy'));
    world.add(player.group);
    if (player.marker) world.add(player.marker);
    if (poseParam !== null) player.frozenPhase = parseFloat(poseParam);
    if (params.get('autowalk')) {
      const d = params.get('autowalk').split(',').map(Number);
      if (d.length === 2 && d.every(isFinite)) {
        const l = Math.hypot(...d) || 1;
        player.autoDir = [d[0] / l, d[1] / l];
      }
    }
  }
  walkMode = true;
  document.getElementById('walkBtn').textContent = 'Karten-Ansicht';
  if (matchMedia('(pointer:coarse)').matches) document.getElementById('joy').style.display = 'block';
  controls.enablePan = false;
  controls.minDistance = 5; controls.maxDistance = 60;
  controls.minPolarAngle = 0.12; controls.maxPolarAngle = 1.5;
  // Kamera steil von oben auf den Charakter (?wcam=dx,dy,dz überschreibt)
  let cx = -1.5, cy = 15, cz = 9;
  if (params.get('wcam')) {
    const w = params.get('wcam').split(',').map(Number);
    if (w.length === 3 && w.every(isFinite)) [cx, cy, cz] = w;
  }
  camera.position.set(player.pos.x + cx, player.pos.y + cy, player.pos.z + cz);
  controls.target.set(player.pos.x, player.pos.y + 1.6, player.pos.z);
  controls.update();
}
function exitWalkMode() {
  walkMode = false;
  document.getElementById('walkBtn').textContent = 'Als Ritter laufen';
  document.getElementById('joy').style.display = 'none';
  controls.enablePan = true;
  controls.minDistance = 30; controls.maxDistance = 240;
  controls.minPolarAngle = 0.12; controls.maxPolarAngle = 1.42;
  setCam('ref');
}
document.getElementById('walkBtn')?.addEventListener('click', () => walkMode ? exitWalkMode() : enterWalkMode());
if (params.has('dbg')) setInterval(() => {
  const s = `${player.pos.x.toFixed(1)},${player.pos.z.toFixed(1)} y${player.pos.y.toFixed(1)} s${player.speed.toFixed(1)} r${player.ready ? 1 : 0} w${walkMode ? 1 : 0} a${player.autoDir ? 1 : 0}`;
  document.title = s;
  const el = document.getElementById('toast');
  if (el && walkMode) { el.textContent = s; el.style.display = 'block'; }
}, 400);
if (params.get('mode') === 'walk') {
  const t0 = setInterval(() => { if (dynamic) { clearInterval(t0); enterWalkMode(); } }, 200);
}

// ---------- HUD ----------
document.getElementById('refBtn')?.addEventListener('click', () => setCam('ref'));

// iOS: bei Context-Verlust Meldung statt Endlos-Reload
renderer.domElement.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  loaderEl.style.display = 'flex';
  loaderTextEl.textContent = 'Grafik-Kontext verloren — bitte Seite neu laden';
});

// ---------- Loop ----------
const clock = new THREE.Clock();
const freeze = params.has('freeze');
// Test-Hook: ?pose=<phase> friert den Walk-Cycle ein (Screenshot-Prüfung)
const poseParam = params.get('pose');
let t0 = 0, frames = 0, degraded = false, perfT0 = -1;
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  const dt = Math.min(t - t0, 0.1); t0 = t;


  if (!freeze) {
    tickWater(world, t);
    for (const c of clouds) { c.s.position.x += dt * c.speed; if (c.s.position.x > 130) c.s.position.x = -130; }
    for (const b of birds) {
      const a = t * 0.25 + b.ph;
      b.b.position.set(-38 + Math.cos(a) * b.r, b.h + Math.sin(t * 2 + b.ph) * 0.6, -30 + Math.sin(a) * b.r);
      b.b.rotation.y = -a;
      b.b.rotation.z = Math.sin(t * 6 + b.ph) * 0.35;
    }
    if (dynamic) {
      for (const b of dynamic.boats) {
        b.node.position.y += Math.sin(t * 1.3 + b.phase) * 0.004;
        b.node.rotation.z = Math.sin(t * 0.9 + b.phase) * 0.03;
      }
      if (dynamic.windmill) {
        const blades = dynamic.windmill.getObjectByName('blades') || dynamic.windmill.getObjectByName('Blades')
          || dynamic.windmill.getObjectByName('wings') || dynamic.windmill.getObjectByName('Rotor');
        if (blades) blades.rotation.z += dt * 0.9;
      }
    }
  }

  if (walkMode && player.ready) {
    player.tick(dt, controls.getAzimuthalAngle(), t);
    // Folgekamera starr: Kamera UND Ziel um dieselbe Differenz schieben,
    // sonst läuft der Ritter aus dem Orbit-Kamerabild
    const want = new THREE.Vector3(player.pos.x, player.pos.y + 1.4, player.pos.z);
    const delta = want.sub(controls.target).multiplyScalar(1 - Math.exp(-8 * dt));
    controls.target.add(delta);
    camera.position.add(delta);
  }

  controls.update();
  renderer.render(scene, camera);

  // Auto-Degradierung: FPS erst messen, sobald die Assets stehen (Ladezeit verfälscht sonst)
  if (dynamic) {
    if (frames === 0) perfT0 = t;
    frames++;
    if (!degraded && frames === 180) {
      const fps = 180 / (t - perfT0);
      if (fps < 28) { renderer.setPixelRatio(Math.min(devicePixelRatio, 1.2)); degraded = true; }
    }
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

setCam(params.get('cam') || 'ref');
