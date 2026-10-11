// Spieler: Ritter-Roboter — Auto-Rig (kein Skelett im GLB), Walk-/Idle-Cycle,
// Folgekamera von schräg oben, WASD/Pfeiltasten + Touch-Joystick, Terrain-Kollision
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { heightAt, slopeAt, coastRadius } from './terrain.js';
import { shrinkGLTF } from './assets.js';

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

export class Player {
  constructor() {
    this.group = new THREE.Group();
    this.mesh = null; this.bones = {}; this.ready = false;
    this.pos = new THREE.Vector3(12, 0, 24);   // offene Wiese südlich des Dorfs
    this.heading = 0;                          // Blick zur Kamera (+z)
    this.walkPhase = 0; this.speed = 0;
    this.frozenPhase = null;              // != null: Pose einfrieren (Test)
    this.keys = {};
    this.joy = { active: false, dx: 0, dy: 0 };
  }

  async load(quality) {
    const gltf = await new Promise((res, rej) =>
      new GLTFLoader().load('./knight-robot.glb', res, undefined, rej));
    if (quality === 'low') shrinkGLTF(gltf, 384);
    let srcMesh = null;
    gltf.scene.traverse(o => { if (o.isMesh && !srcMesh) srcMesh = o; });
    const geo = srcMesh.geometry;
    geo.computeVertexNormals();

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
    this.hipsY0 = this.bones.hips.position.y;

    const s = 2.4 / 0.864;                  // Ritter ~2.4 Welt-Einheiten groß
    this.mesh.scale.setScalar(s);
    this.mesh.position.y = s * 0.432;       // Füße auf Boden
    this.mesh.castShadow = quality !== 'low';
    this.group.add(this.mesh);
    this.group.position.set(this.pos.x, heightAt(this.pos.x, this.pos.z), this.pos.z);
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
    let x = 0, z = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) z -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) z += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
    if (this.joy.active) { x += this.joy.dx; z += this.joy.dy; }
    const l = Math.hypot(x, z);
    return l > 0 ? [x / l, z / l] : [0, 0];
  }

  walkable(x, z) {
    if (heightAt(x, z) < 0.85) return false;             // Wasser/Ufer
    if (slopeAt(x, z) > 0.95) return false;              // Klippen/Berghang
    const th = Math.atan2(z, x);
    if (Math.hypot(x, z) > coastRadius(th) * 0.95) return false;
    return true;
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
      const want = Math.atan2(mx, mz);
      let d = want - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, dt * 10);
      this.speed = Math.min(1, this.speed + dt * 6);
    } else {
      this.speed = Math.max(0, this.speed - dt * 5);
    }
    this.pos.y = heightAt(this.pos.x, this.pos.z);
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
  }
}
