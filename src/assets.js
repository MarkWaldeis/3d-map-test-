// GLB-Assets laden, platzieren, instanzieren (Bäume/Zäune/Felsen -> InstancedMesh)
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { mergeGeometries } from '../vendor/utils/BufferGeometryUtils.js';
import { WORLD, ZONES, PLACEMENTS, SCATTER, FENCES, RIVER } from './layout.js';
import { heightAt, slopeAt, riverDist, pathDist, coastRadius, fbm } from './terrain.js';

const K = WORLD.unitK;
const loader = new GLTFLoader();
const cache = new Map();

export function loadAll(files, onProgress) {
  let done = 0;
  return Promise.all(files.map(f => new Promise((res, rej) => {
    loader.load('./' + f, g => {
      cache.set(f, g);
      onProgress && onProgress(++done, files.length);
      res(g);
    }, undefined, rej);
  })));
}

// Ein GLB -> eine gemergte Geometrie + Referenzmaterial (für InstancedMesh)
function mergedGeometry(gltf) {
  const geos = [];
  let material = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (o.isMesh) {
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      for (const key of Object.keys(g.attributes)) {
        if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
      }
      geos.push(g);
      if (!material) material = o.material;
    }
  });
  if (!geos.length) return null;
  const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
  return { geometry: merged, material };
}

// ganze GLB-Szene klonen (für Einzelplatzierungen)
function cloneScene(gltf, shadows) {
  const s = gltf.scene.clone(true);
  s.traverse(o => {
    if (o.isMesh) {
      o.castShadow = shadows;
      o.receiveShadow = true;
      if (o.material && o.material.map) o.material.map.anisotropy = 4;
    }
  });
  return s;
}

// ---------- Ausschluss-Logik für Scatter ----------
const inRect = (x, z, r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
function blocked(x, z) {
  const h = heightAt(x, z);
  if (h < 0.6) return true;                       // Wasser/Klippe
  if (slopeAt(x, z) > 0.75) return true;
  if (riverDist(x, z) < 3.2) return true;
  if (pathDist(x, z) < 1.8) return true;
  if (Math.hypot(x - ZONES.plaza.x, z - ZONES.plaza.z) < ZONES.plaza.r + 1) return true;
  if (Math.hypot(x - ZONES.lake.x, z - ZONES.lake.z) < ZONES.lake.r + 1.5) return true;
  if (Math.hypot(x - ZONES.fields.x, z - ZONES.fields.z) < ZONES.fields.r) return true;
  if (Math.hypot(x - ZONES.beach.x, z - ZONES.beach.z) < ZONES.beach.r) return true;
  if (Math.hypot(x - ZONES.village.x, z - ZONES.village.z) < ZONES.village.r) return true;
  if (Math.hypot(x - ZONES.castleIslet.x, z - ZONES.castleIslet.z) < ZONES.castleIslet.r + 1.5) return true;
  if (Math.hypot(x - ZONES.windmillHill.x, z - ZONES.windmillHill.z) < 4.5) return true;
  const th = Math.atan2(z, x);
  if (Math.hypot(x, z) > coastRadius(th) * 0.93) return true; // nicht zu nah am Rand
  return false;
}
function rand(seedObj) { // einfacher deterministischer RNG
  seedObj.s = (seedObj.s * 1664525 + 1013904223) % 4294967296;
  return seedObj.s / 4294967296;
}

function scatterPoints(spec) {
  const pts = [];
  const rng = { s: 1234 + spec.count * 7 };
  let guard = 0;
  while (pts.length < spec.count && guard++ < spec.count * 60) {
    let x, z;
    if (spec.in) {
      const r = ZONES[spec.in];
      x = r.x0 + (r.x1 - r.x0) * rand(rng);
      z = r.z0 + (r.z1 - r.z0) * rand(rng);
      // Wald dichter clumpen
      if (rand(rng) < 0.3) { x += (rand(rng) - 0.5) * 8; z += (rand(rng) - 0.5) * 8; }
    } else if (spec.coast) {
      const th = rand(rng) * Math.PI * 2;
      const rr = coastRadius(th) * (0.82 + rand(rng) * 0.1);
      x = Math.cos(th) * rr; z = Math.sin(th) * rr;
    } else if (spec.near) {
      const p = spec.near[Math.floor(rand(rng) * spec.near.length)];
      x = p[0] + (rand(rng) - 0.5) * 2 * (spec.spread || 5);
      z = p[1] + (rand(rng) - 0.5) * 2 * (spec.spread || 5);
    } else {
      const th = rand(rng) * Math.PI * 2, rr = Math.sqrt(rand(rng)) * 42;
      x = Math.cos(th) * rr; z = Math.sin(th) * rr;
    }
    if (!blocked(x, z)) pts.push([x, z]);
  }
  return pts;
}

// ---------- Platzierung ----------
export function buildAssets(scene, shadows) {
  const dynamic = { boats: [], windmill: null };

  // 1) feste Platzierungen (Klone)
  for (const p of PLACEMENTS) {
    const gltf = cache.get(p.file);
    if (!gltf) continue;
    if (p.grid) {
      const { x0, z0, dx, dz, nx, nz, s } = p.grid;
      for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
        place(cloneScene(gltf, shadows), p, x0 + ix * dx, z0 + iz * dz, { scaleOverride: s });
      }
      continue;
    }
    for (const a of p.at) {
      const node = cloneScene(gltf, shadows);
      place(node, p, a[0], a[1], { ry: a[2] || 0 });
      if (p.water) dynamic.boats.push({ node, phase: a[0] * 1.7 });
      if (p.file === 'windmill.glb') dynamic.windmill = node;
    }
  }

  // 2) Scatter -> InstancedMesh
  const byFile = new Map();
  for (const s of SCATTER) {
    if (!byFile.has(s.file)) byFile.set(s.file, []);
    for (const [x, z] of scatterPoints(s)) byFile.get(s.file).push({ x, z, s: s.size, j: s.jitter });
  }
  for (const [file, list] of byFile) {
    const gltf = cache.get(file);
    const mg = gltf && mergedGeometry(gltf);
    if (!mg) continue;
    const im = new THREE.InstancedMesh(mg.geometry, mg.material, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
    list.forEach((it, i) => {
      const sc = it.s * K * (1 + (fbm(it.x * 0.4, it.z * 0.4) - 0.5) * 2 * (it.j || 0.2));
      e.set(0, fbm(it.x, it.z) * Math.PI * 4, 0);
      q.setFromEuler(e);
      v.set(it.x, heightAt(it.x, it.z) + sc * 0.5 - sc * 0.06, it.z);
      m4.compose(v, q, new THREE.Vector3(sc, sc, sc));
      im.setMatrixAt(i, m4);
    });
    im.castShadow = shadows; im.receiveShadow = true;
    im.name = 'inst_' + file;
    scene.add(im);
  }

  // 3) Zäune entlang Linien -> InstancedMesh
  const fg = cache.get('fence_wood.glb');
  const fmg = fg && mergedGeometry(fg);
  if (fmg) {
    const posts = [];
    for (const line of FENCES) {
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, az] = line[i], [bx, bz] = line[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.max(1, Math.round(len / 1.6));
        for (let k = 0; k < n; k++) {
          const t = k / n;
          posts.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, ry: Math.atan2(bx - ax, bz - az) });
        }
      }
    }
    const im = new THREE.InstancedMesh(fmg.geometry, fmg.material, posts.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    posts.forEach((pt, i) => {
      const sc = 0.3 * K;
      e.set(0, pt.ry, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(pt.x, heightAt(pt.x, pt.z) + sc * 0.45, pt.z), q, new THREE.Vector3(sc, sc, sc));
      im.setMatrixAt(i, m4);
    });
    im.castShadow = shadows; im.receiveShadow = true;
    im.name = 'inst_fence';
    scene.add(im);
  }

  // Burg auf den Felsen setzen
  function place(node, p, x, z, { ry = 0, scaleOverride = null } = {}) {
    const s = (scaleOverride ?? p.size) * K;
    node.scale.setScalar(s);
    if (p.squash) node.scale.set(s * p.squash[0], s * p.squash[1], s * p.squash[2]);
    if (p.brighten) node.traverse(o => { if (o.material && o.material.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(p.brighten); } });
    let y;
    if (p.yOverride !== undefined) y = p.yOverride;
    else if (p.onTopOf) {
      const base = PLACEMENTS.find(b => b.file === p.onTopOf);
      const baseTop = heightAt(x, z) + base.size * K * (1 - (base.sinkFrac ?? 0));
      y = baseTop + s * 0.5;
    } else if (p.water) y = WORLD.seaLevel + s * 0.42;
    else if (p.squash) y = heightAt(x, z) + s * p.squash[1] * 0.5;
    else {
      const sink = p.sinkFrac ?? 0.05;
      y = heightAt(x, z) + s * (0.5 - sink);
    }
    node.position.set(x, y, z);
    node.rotation.y = ry;
    scene.add(node);
  }

  return dynamic;
}
