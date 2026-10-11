// Spieler: Ritter-Roboter — Auto-Rig (kein Skelett im GLB), Walk-/Idle-Cycle,
// Folgekamera von schräg oben, WASD/Pfeiltasten + Touch-Joystick, Terrain-Kollision
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { heightAt, slopeAt } from './terrain.js';

// ---------- Skelett (Modell-lokal, BBox ~x±0.5 y±0.43 z±0.32, Positionen RELATIV zum Parent) ----------
// Körpermitte x≈+0.08, Beine x≈0.0 (L) / +0.16 (R), Kopf x≈+0.09, Waffen-Arm +x, Cape −z, Füße y≈−0.43
const HIP_Y = -0.16, NECK_Y = 0.235;
const BONES = [
  { n: 'hips',    p: [0.08, HIP_Y, 0],      parent: null },
  { n: 'spine',   p: [0, 0.14, 0],          parent: 'hips' },
  { n: 'chest',   p: [0, 0.12, 0],          parent: 'spine' },
  { n: 'head',    p: [0.01, 0.135, -0.03],  parent: 'chest' },
  { n: 'thighL',  p: [-0.08, 0, 0],         parent: 'hips' },
  { n: 'kneeL',   p: [0, -0.14, 0],         parent: 'thighL' },
  { n: 'footL',   p: [0, -0.10, 0.02],      parent: 'kneeL' },
  { n: 'thighR',  p: [0.08, 0, 0],          parent: 'hips' },
  { n: 'kneeR',   p: [0, -0.14, 0],         parent: 'thighR' },
  { n: 'footR',   p: [0, -0.10, 0.02],      parent: 'kneeR' },
  { n: 'shArm',   p: [0.16, -0.14, -0.04],  parent: 'chest' },
  { n: 'foreArm', p: [0.12, -0.01, -0.01],  parent: 'shArm' },
];
const boneIndex = Object.fromEntries(BONES.map((b, i) => [b.n, i]));
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Region -> max. 4 Knochengewichte (weiche Übergänge)
function weightsAt(x, y, z) {
  const cape = sstep(0.10, 0.16, -z);       // 0 vorne .. 1 hinten (Cape/Rücken)
  // Waffen-Arm: x>~0.22 in Torso-Höhe -> shArm/foreArm
  const inArmBand = (y > -0.24 && y < 0.09 && z > -0.28 && z < 0.14);
  const armW = sstep(0.20, 0.27, x) * (inArmBand ? 1 : 0) * (1 - cape);
  if (armW > 0.35) {
    const t = sstep(0.30, 0.40, x);         // Ellbogen-Blend
    return [[boneIndex.shArm, armW * (1 - t)], [boneIndex.foreArm, armW * t], [boneIndex.chest, 1 - armW]];
  }
  if (y < HIP_Y + 0.03) {
    // Beine: Seite nach x-Cluster (L≈0, R≈+0.16), Blend um x≈0.08; Cape-Anteil -> Hüfte
    const side = sstep(0.05, 0.11, x);
    const tK = sstep(0.26, 0.335, -y);      // Oberschenkel -> Knie
    const tF = sstep(0.37, 0.42, -y);       // Knie -> Fuß
    const w = [1 - tK, tK * (1 - tF), tF];
    const L = [boneIndex.thighL, boneIndex.kneeL, boneIndex.footL];
    const R = [boneIndex.thighR, boneIndex.kneeR, boneIndex.footR];
    const legW = 1 - cape, out = [];
    for (let i = 0; i < 3; i++) {
      if (w[i] * legW > 1e-4) {
        if (1 - side > 1e-4) out.push([L[i], w[i] * legW * (1 - side)]);
        if (side > 1e-4) out.push([R[i], w[i] * legW * side]);
      }
    }
    if (cape > 1e-4) out.push([boneIndex.hips, cape]);
    out.sort((a, b) => b[1] - a[1]);
    return out.slice(0, 4);
  }
  // Oberkörper: hips -> spine -> chest -> head entlang y
  if (y < 0.04) {
    const t = sstep(-0.10, 0.02, y);
    return [[boneIndex.hips, (1 - t) * (1 - cape)], [boneIndex.spine, t * (1 - cape)], [boneIndex.hips, cape]];
  }
  if (y < NECK_Y + 0.02) {
    const t = sstep(0.04, 0.16, y);
    return [[boneIndex.spine, 1 - t], [boneIndex.chest, t]];
  }
  const t = sstep(NECK_Y - 0.01, NECK_Y + 0.05, y);
  return [[boneIndex.chest, 1 - t], [boneIndex.head, t]];
}

// Begehbare Brücken-Korridore: das Terrain unter der Brücke ist Wasser,
// die Brücke selbst ist nur Geometrie — hier als begehbare „Brücke“ modelliert.
const BRIDGES = [
  { a: [22.6, -6.6], b: [29.2, -11.2], w: 2.2, yA: 3.0, yB: 5.2 },  // Steinbrücke -> Burg-Insel
  { a: [-11.1, 4.25], b: [-7.7, 2.55], w: 1.6 },                    // Holzbrücke West
  { a: [-6.3, 17.35], b: [-2.5, 15.45], w: 1.6 },                   // Holzbrücke Süd
];

// Begehbarkeit: Kreis-Hindernisse (Häuser, Brunnen, Mühle, Felsen, Kisten …)
const OBSTACLES = [
  [-7, 1.5, 3.0], [10, 0.5, 3.0], [11.5, 10, 3.0], [6.5, 15.5, 3.0], [-4.5, 14, 3.0], [5.5, 11.5, 3.0],   // Häuser blau
  [-8.5, 10.5, 3.0], [0.5, 16.5, 3.0], [-2.5, -1.5, 3.0], [-1.5, 17.8, 3.0],                              // Häuser rot
  [13, -4, 3.3], [-13, 4.5, 3.3],                                                                        // Schornstein-Häuser
  [2, 6, 1.8],                                                                                          // Brunnen
  [-27, -10, 3.6],                                                                                      // Windmühle
  [-25, 17, 3.2], [-22.5, 22.5, 1.7], [-9, 16.5, 1.7],                                                    // Scheune/Schuppen
  [31, -9, 4.6],                                                                                        // Burg
  [14.5, 19.5, 0.9], [4.5, 3.5, 0.9], [-1.5, 11.5, 0.9], [22.5, 18.5, 0.9],                               // Kisten
  [-3.5, 4, 0.5], [7.5, 4.5, 0.5], [9, 12.5, 0.5], [-6, 9.5, 0.5], [1.5, 13.5, 0.5], [12, 6, 0.5],         // Lampen
  [-8.5, -1, 0.5], [5.5, 16.5, 0.5], [-15, 13.5, 0.5],                                                    // Wegweiser
  [17, -8, 1.7], [33, -13.5, 0.9], [34, -12.8, 0.9], [31.5, -17.5, 0.9], [-26, 12, 0.9], [-31, 7, 1.3],   // Kristalle/Ruine
  [-17, -29, 6.5], [3, -31, 6.5], [18, -25, 6.0], [-8, -30.5, 5.5], [11, -28, 5.5],                       // Bergmassive
];

export class Player {
  constructor() {
    this.group = new THREE.Group();
    this.mesh = null; this.bones = {}; this.ready = false;
    this.spawn = new THREE.Vector3(2, 0, 9.5);   // fester Spawn: Plaza südlich des Brunnens
    this.pos = this.spawn.clone();
    this.heading = 0;                          // Blick zur Kamera (+z)
    this.walkPhase = 0; this.speed = 0;
    this.frozenPhase = null;              // != null: Pose einfrieren (Test)
    this.keys = {};
    this.joy = { active: false, dx: 0, dy: 0 };
    this.marker = null;
    this.autoDir = null;                    // Test: automatisch laufen
  }

  // Brücken-Deckhöhe (Rampe über die Länge), sonst null
  bridgeY(x, z) {
    for (const br of BRIDGES) {
      const ax = x - br.a[0], az = z - br.a[1];
      const bx = br.b[0] - br.a[0], bz = br.b[1] - br.a[1];
      const t = Math.max(0, Math.min(1, (ax * bx + az * bz) / (bx * bx + bz * bz)));
      const d = Math.hypot(ax - t * bx, az - t * bz);
      if (d < br.w) {
        if (br.yA !== undefined) return br.yA + (br.yB - br.yA) * t;
        return Math.max(heightAt(x, z), Math.max(heightAt(...br.a), heightAt(...br.b)) + 0.7);
      }
    }
    return null;
  }
  groundY(x, z) {
    const by = this.bridgeY(x, z);
    return by !== null ? by : heightAt(x, z);
  }
  walkable(x, z) {
    if (this.bridgeY(x, z) !== null) return true;   // Brücken immer begehbar
    if (heightAt(x, z) < 0.45) return false;        // Wasser (Strand h≈0.55 bleibt trocken)
    if (slopeAt(x, z) > 2.2) return false;          // nur senkrechte Felswände
    for (const [ox, oz, or_] of OBSTACLES)
      if ((x - ox) * (x - ox) + (z - oz) * (z - oz) < or_ * or_) return false;
    return true;
  }

  async load(quality) {
    // Original-GLB hat ~736k Vertices — zu schwer für SkinnedMesh.
    // Vordezimiert mit gltfpack (736k -> 36k Vertices) — Original-GLB würde
    // jeden Frame ausbremsen; f32-Attribute, damit weightsAt echte Positionen liest.
    const url = './knight-robot-walk.glb';
    const gltf = await new Promise((res, rej) =>
      new GLTFLoader().load(url, res, undefined, rej));
    this._stage?.('parse fertig');
    let srcMesh = null;
    gltf.scene.traverse(o => { if (o.isMesh && !srcMesh) srcMesh = o; });
    const geo = srcMesh.geometry;
    geo.computeVertexNormals();
    this._stage?.('normals fertig');

    // Skin-Attribute bauen
    const posA = geo.getAttribute('position');
    const n = posA.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const w = weightsAt(posA.getX(i), posA.getY(i), posA.getZ(i));
      const tot = w.reduce((a, b) => a + b[1], 0) || 1;
      for (let k = 0; k < 4; k++) {
        si[i * 4 + k] = k < w.length ? w[k][0] : 0;
        sw[i * 4 + k] = k < w.length ? w[k][1] / tot : 0;
      }
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    this._stage?.('skin fertig');

    const mat = srcMesh.material.clone();
    if (mat.map) mat.map.anisotropy = quality === 'low' ? 1 : 4;
    if (mat.color) mat.color.multiplyScalar(1.1);
    this.mesh = new THREE.SkinnedMesh(geo, mat);
    this.mesh.frustumCulled = false;

    // Skelett aufbauen (Positionen relativ zum Parent — siehe BONES)
    const boneObjs = BONES.map(() => new THREE.Bone());
    BONES.forEach((b, i) => {
      boneObjs[i].name = b.n;
      boneObjs[i].position.set(b.p[0], b.p[1], b.p[2]);
      if (b.parent) boneObjs[boneIndex[b.parent]].add(boneObjs[i]);
      this.bones[b.n] = boneObjs[i];
    });
    this.mesh.add(boneObjs[0]);
    this.mesh.updateMatrixWorld(true);
    this.mesh.bind(new THREE.Skeleton(boneObjs));
    this._stage?.('rig fertig');
    this.hipsY0 = this.bones.hips.position.y;

    const s = 2.4 / 0.864;                  // Ritter ~2.4 Welt-Einheiten groß
    this.mesh.scale.setScalar(s);
    this.mesh.position.y = s * 0.432;       // Füße auf Boden
    this.mesh.castShadow = quality !== 'low';
    this.group.add(this.mesh);
    this.group.position.set(this.pos.x, heightAt(this.pos.x, this.pos.z), this.pos.z);

    // Sichtbare Spawn-Markierung: pulsierender Ring + Lichtsäule
    const ringGeo = new THREE.TorusGeometry(1.5, 0.12, 8, 40);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.85 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x9feaff, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 9, 24, 1, true), beamMat);
    beam.position.y = 4.5;
    this.marker = new THREE.Group();
    this.marker.add(ring, beam);
    this.marker.position.set(this.spawn.x, heightAt(this.spawn.x, this.spawn.z) + 0.12, this.spawn.z);
    this.ready = true;
  }

  bindInput(joystickEl) {
    addEventListener('keydown', e => { this.keys[e.code] = true; });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    if (joystickEl) {
      const knob = joystickEl.querySelector('.knob');
      joystickEl.addEventListener('pointerdown', e => {
        this.joy.active = true; joystickEl.setPointerCapture(e.pointerId);
        e.preventDefault(); e.stopPropagation();
      });
      joystickEl.addEventListener('pointermove', e => {
        if (!this.joy.active) return;
        const r = joystickEl.getBoundingClientRect();
        let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        this.joy.dx = dx; this.joy.dy = dy;
        knob.style.transform = `translate(${dx * 26}px,${dy * 26}px)`;
        e.preventDefault(); e.stopPropagation();
      });
      const end = () => {
        this.joy.active = false; this.joy.dx = this.joy.dy = 0;
        knob.style.transform = 'translate(0,0)';
      };
      joystickEl.addEventListener('pointerup', end);
      joystickEl.addEventListener('pointercancel', end);
    }
  }

  inputVec() {
    if (this.autoDir) return this.autoDir;  // ?autowalk Test
    let x = 0, z = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) z -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) z += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
    if (this.joy.active) { x += this.joy.dx; z += this.joy.dy; }
    const l = Math.hypot(x, z);
    return l > 0 ? [x / l, z / l] : [0, 0];
  }

  tick(dt, camYaw, t) {
    if (!this.ready) return;
    if (this.frozenPhase !== null) this.keys = {};
    const [ix, iz] = this.inputVec();
    // Vorwärts = Kamera->Charakter-Richtung (OrbitControls-Azimut)
    const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
    const fwdX = -sy, fwdZ = -cy;
    const rgtX = -fwdZ, rgtZ = fwdX;
    const mx = fwdX * -iz + rgtX * ix;
    const mz = fwdZ * -iz + rgtZ * ix;
    const moving = (ix !== 0 || iz !== 0);
    const SPEED = 6.0;
    if (moving) {
      const nx = this.pos.x + mx * SPEED * dt;
      const nz = this.pos.z + mz * SPEED * dt;
      if (this.walkable(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
      else if (this.walkable(nx, this.pos.z)) this.pos.x = nx;
      else if (this.walkable(this.pos.x, nz)) this.pos.z = nz;
      else {
        // Tangenten-Slide: Bewegung entlang des Hindernis-Kreises projizieren,
        // sonst klemmt man diagonal an Häusern/Felsen fest.
        for (const [ox, oz, or_] of OBSTACLES) {
          const dx = this.pos.x - ox, dz = this.pos.z - oz;
          const d = Math.hypot(dx, dz);
          if (d < or_ + 0.4 && d > 1e-4) {
            const tx = -dz / d, tz = dx / d;
            const mt = (mx * tx + mz * tz) * SPEED * dt;
            const sx = this.pos.x + tx * mt, sz = this.pos.z + tz * mt;
            if (this.walkable(sx, sz)) { this.pos.x = sx; this.pos.z = sz; }
            break;
          }
        }
      }
      // Penetration auflösen: minimal aus Kreisen rausschieben
      for (const [ox, oz, or_] of OBSTACLES) {
        const dx = this.pos.x - ox, dz = this.pos.z - oz;
        const d = Math.hypot(dx, dz);
        if (d > 1e-4 && d < or_) {
          this.pos.x = ox + (dx / d) * or_;
          this.pos.z = oz + (dz / d) * or_;
        }
      }
      const want = Math.atan2(mx, mz);
      let d = want - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, dt * 10);
      this.speed = Math.min(1, this.speed + dt * 6);
    } else {
      this.speed = Math.max(0, this.speed - dt * 5);
    }
    const gy = this.groundY(this.pos.x, this.pos.z);
    this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 12);   // weicher Übergang Brücke<->Terrain
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;             // Modell blickt +z

    // ---------- Walk-/Idle-Animation ----------
    const B = this.bones;
    this.walkPhase += dt * this.speed * 7.5;
    const ph = this.frozenPhase !== null ? this.frozenPhase : this.walkPhase;
    const s = Math.sin(ph), c = Math.cos(ph);
    const amp = this.frozenPhase !== null ? 1 : this.speed;
    // Vorzeichen: Modell blickt +z; -x-Rotation schwenkt Bein nach +z (vorn),
    // +x-Rotation beugt Knie (Ferse nach hinten) und lehnt Torso nach vorn
    B.thighL.rotation.x = -s * 0.72 * amp;
    B.thighR.rotation.x = s * 0.72 * amp;
    B.kneeL.rotation.x = (Math.max(0, -c) * 0.9 + Math.max(0, -s) * 0.15) * amp;
    B.kneeR.rotation.x = (Math.max(0, c) * 0.9 + Math.max(0, s) * 0.15) * amp;
    B.footL.rotation.x = s * 0.25 * amp - 0.08 * amp;
    B.footR.rotation.x = -s * 0.25 * amp - 0.08 * amp;
    B.hips.rotation.z = s * 0.05 * amp;
    B.hips.position.y = this.hipsY0 + Math.abs(c) * 0.02 * amp - 0.01 * amp;
    B.spine.rotation.x = 0.08 * amp + Math.sin(t * 1.7) * 0.012 * (1 - amp);
    B.spine.rotation.z = -s * 0.045 * amp;
    B.chest.rotation.y = -s * 0.08 * amp;
    B.chest.rotation.x = Math.sin(t * 1.7) * 0.015 * (1 - amp) + 0.03 * amp;
    B.head.rotation.z = s * 0.02 * amp;
    B.head.rotation.x = -0.05 * amp;
    B.shArm.rotation.y = -s * 0.5 * amp;              // Waffenarm schwingt vorn/ zurück
    B.shArm.rotation.z = Math.sin(t * 1.4) * 0.02 * (1 - amp) - 0.05 * amp;
    B.foreArm.rotation.y = -s * 0.15 * amp;

    // Spawn-Marker pulsieren
    if (this.marker) {
      const p = 1 + Math.sin(t * 2.4) * 0.08;
      this.marker.children[0].scale.setScalar(p);
      this.marker.children[0].material.opacity = 0.6 + Math.sin(t * 2.4) * 0.25;
    }
  }
}
