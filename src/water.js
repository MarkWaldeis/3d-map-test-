// Wasser: Meer, See, Fluss, Wasserfall — stilisierter Look passend zum Referenzbild
import * as THREE from 'three';
import { WORLD, ZONES, RIVER } from './layout.js';
import { coastRadius, fbm } from './terrain.js';

const waterVert = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNorm;
  uniform float uTime;
  uniform float uWaveAmp;
  void main() {
    vUv = uv;
    vec3 p = position;
    float ph1 = p.x * 0.16 + uTime * 1.1;
    float ph2 = p.z * 0.13 + uTime * 0.9;
    float ph3 = p.x * 0.05 - uTime * 0.6 + p.z * 0.07;
    float w = sin(ph1) * cos(ph2) + 0.6 * sin(ph3);
    p.y += w * uWaveAmp;
    // analytische Ableitungen -> echte Wellen-Normale für Licht/Fresnel
    float dx = 0.16 * cos(ph1) * cos(ph2) + 0.6 * 0.05 * cos(ph3);
    float dz = -0.13 * sin(ph1) * sin(ph2) + 0.6 * 0.07 * cos(ph3);
    vNorm = normalize(vec3(-dx * uWaveAmp, 1.0, -dz * uWaveAmp));
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const waterFrag = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNorm;
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uSky;
  uniform vec3 uSunDir;
  uniform vec2 uOrigin;    // Welt-XZ der Gewässer-Mitte
  uniform float uCenter;   // Distanz-Mitte für Tiefenverlauf
  uniform float uStripe;   // Wellenstreifen-Stärke
  uniform float uSpec;     // Sonnen-Glitzer
  void main() {
    // feine Ripple-Störung auf der Welle-Normale
    vec3 n = normalize(vNorm + vec3(
      sin(vWorld.x * 1.9 + uTime * 1.8 + vWorld.z * 0.6) * 0.12
        + sin(vWorld.x * 4.3 - uTime * 2.7 + vWorld.z * 1.3) * 0.06,
      0.0,
      sin(vWorld.z * 2.1 - uTime * 1.6 + vWorld.x * 0.7) * 0.12
        + sin(vWorld.z * 3.9 + uTime * 2.3 + vWorld.x * 1.1) * 0.06));
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float d = length(vWorld.xz - uOrigin) / uCenter;
    vec3 base = mix(uShallow, uDeep, clamp(d * d * 1.15, 0.0, 1.0));
    // Fresnel: flacher Blickwinkel -> Himmelsreflexion
    float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 3.0);
    vec3 col = mix(base, uSky, clamp(fres * 0.7, 0.0, 1.0));
    // wandernde helle Streifen
    float s = sin(vWorld.x * 0.55 + vWorld.z * 0.35 + uTime * 1.4)
            * sin(vWorld.z * 0.7 - uTime * 1.1 + vWorld.x * 0.2);
    s = smoothstep(0.55, 0.95, s) * uStripe;
    // zweite, feinere Welle
    float s2 = sin(vWorld.x * 1.3 - uTime * 1.9 + vWorld.z * 1.1);
    s += smoothstep(0.86, 0.99, s2) * uStripe * 0.5;
    col += vec3(s);
    // Sonnen-Glitzer (Blinn)
    vec3 h = normalize(viewDir + uSunDir);
    float spec = pow(max(dot(n, h), 0.0), 80.0) * uSpec;
    col += vec3(1.0, 0.98, 0.9) * spec;
    gl_FragColor = vec4(col, 1.0);
  }`;

function waterMat({ shallow, deep, center, stripe = 0.12, amp = 0.18, sky = 0xcfeef7, spec = 0.8, origin = [0, 0] }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color(shallow) },
      uDeep: { value: new THREE.Color(deep) },
      uSky: { value: new THREE.Color(sky) },
      uSunDir: { value: new THREE.Vector3(-0.46, 0.81, -0.34).normalize() },
      uOrigin: { value: new THREE.Vector2(origin[0], origin[1]) },
      uCenter: { value: center },
      uStripe: { value: stripe },
      uWaveAmp: { value: amp },
      uSpec: { value: spec },
    },
    vertexShader: waterVert,
    fragmentShader: waterFrag,
  });
}

export function buildSea() {
  const geo = new THREE.PlaneGeometry(340, 340, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const mat = waterMat({ shallow: 0x66d6de, deep: 0x237fb5, center: 150, stripe: 0.055, amp: 0.22, spec: 0.5 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WORLD.seaLevel;
  mesh.name = 'sea';
  return mesh;
}

// Schaumring, der der Küstenlinie folgt
function foamRing(radiusFn, y, width, color, opacity, segs = 160) {
  const verts = [], uvs = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const th = (i / segs) * Math.PI * 2;
    const r = radiusFn(th);
    const c = Math.cos(th), s = Math.sin(th);
    verts.push(c * (r - width * 0.5), y, s * (r - width * 0.5));
    verts.push(c * (r + width * 1.6), y, s * (r + width * 1.6));
    uvs.push(i / segs * 24, 0, i / segs * 24, 1);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = a + 1, c2 = a + 2, d = a + 3;
    idx.push(a, c2, b, b, c2, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOp: { value: opacity } },
    vertexShader: `varying vec2 vUv; uniform float uTime;
      void main(){ vUv=uv; vec3 p=position; p.y += sin(uv.x*6.2831*3.0+uTime*1.6)*0.03; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uColor; uniform float uOp;
      void main(){
        float edge = 1.0 - vUv.y;                       // innen stärker
        float dash = 0.5 + 0.5*sin(vUv.x*6.2831*2.0 - uTime*1.8);
        float a = uOp * edge * (0.45 + 0.55*dash);
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  return new THREE.Mesh(g, mat);
}

export function buildFoam() {
  const group = new THREE.Group();
  group.add(foamRing(th => coastRadius(th) + 0.4, WORLD.seaLevel + 0.06, 1.3, 0xffffff, 0.9));
  group.add(foamRing(th => coastRadius(th) + 2.8, WORLD.seaLevel + 0.05, 2.0, 0xdff6f8, 0.4));
  // Burg-Inselchen
  group.add(foamRing(() => ZONES.castleIslet.r + 0.3, WORLD.seaLevel + 0.06, 0.7, 0xffffff, 0.8)
    .translateX(ZONES.castleIslet.x).translateZ(ZONES.castleIslet.z));
  // See
  const lakeFoam = foamRing(() => ZONES.lake.r + 0.15, 0.92, 0.5, 0xffffff, 0.7);
  lakeFoam.position.set(ZONES.lake.x, 0, ZONES.lake.z);
  lakeFoam.scale.set(0.95, 1, 0.73); // an Seemesh (r*1.15/0.9 * scale 0.82) angepasst
  group.add(lakeFoam);
  group.name = 'foam';
  return group;
}

// See + Fluss + Wasserfall -----------------------------------------------
export function buildLake() {
  const shape = new THREE.Shape();
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2;
    const r = ZONES.lake.r * (1 + 0.14 * (fbm(Math.cos(th) * 2 + 8, Math.sin(th) * 2) - 0.5)) * (1 + 0.1 * Math.sin(th * 2));
    const px = Math.cos(th) * r * 1.15, pz = Math.sin(th) * r * 0.9;
    i === 0 ? shape.moveTo(px, pz) : shape.lineTo(px, pz);
  }
  const geo = new THREE.ShapeGeometry(shape, 24);
  geo.rotateX(-Math.PI / 2);
  const mat = waterMat({ shallow: 0x5fcddd, deep: 0x2588b3, center: 26, stripe: 0.07, amp: 0.05, spec: 0.7, origin: [ZONES.lake.x, ZONES.lake.z] });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(0.82, 1, 0.82);
  mesh.position.set(ZONES.lake.x, 0.95, ZONES.lake.z);
  mesh.name = 'lake';
  return mesh;
}

export function buildRiver(heightFn) {
  // Band entlang RIVER.pts — y, oyulan yatağın hemen üstünde kalır
  const pts = RIVER.pts.map(([x, z]) => new THREE.Vector2(x, z));
  const curve = new THREE.SplineCurve(pts);
  const N = 100, W = 6.0;
  const verts = [], uvs = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const nx = -tan.y, nz = tan.x;
    const wHalf = W * (0.5 + 0.3 * t);
    // su yüzeyi yatak üstünde ~0.9 — kanal içinde belirgin bant
    const bed = heightFn ? heightFn(p.x, p.y) : 0;
    const y = Math.max(bed + 0.9, 0.06);
    // Ränder ans Terrain clampen, damit das Band keine Hänge durchsticht
    const lx = p.x - nx * wHalf, lz = p.y - nz * wHalf;
    const rx = p.x + nx * wHalf, rz = p.y + nz * wHalf;
    const yl = heightFn ? Math.min(y, heightFn(lx, lz) + 0.05) : y;
    const yr = heightFn ? Math.min(y, heightFn(rx, rz) + 0.05) : y;
    verts.push(lx, yl, lz, rx, yr, rz);
    uvs.push(0, t * 30, 1, t * 30);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = waterMat({ shallow: 0x63d4dd, deep: 0x2f97bd, center: 60, stripe: 0.09, amp: 0.04, spec: 0.6 });
  // Fließrichtung entlang uv.y
  mat.fragmentShader = mat.fragmentShader.replace(
    'float s = sin(vWorld.x * 0.55',
    'float s = sin(vUv.y * 2.2 - uTime * 3.0 + vUv.x) * 0.6 + sin(vWorld.x * 0.55'
  );
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'river';
  return mesh;
}

export function buildWaterfall(heightFn) {
  const group = new THREE.Group();
  // XZ-Verlauf vom Bergspalt zum Hang-Knie; y folgt dem Terrain (klebt am Hang)
  const top = new THREE.Vector3(-2.5, 0, -25.8);
  const mid = new THREE.Vector3(-3.2, 0, -22.5);
  const bot = new THREE.Vector3(-3.5, 0, -21.3);
  const curve = new THREE.QuadraticBezierCurve3(top, mid, bot);
  const N = 22, W = 3.2;
  const hFn = heightFn || ((x, z) => 10);
  const startY = hFn(top.x, top.z) + 2.0; // tritt leicht erhöht aus dem Fels
  const edgeY = (x, z, t) => {
    const ty = hFn(x, z) + 0.12;
    return t < 0.18 ? startY + (ty - startY) * (t / 0.18) : ty;
  };
  const verts = [], uvs = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = curve.getPoint(t);
    const wHalf = W * (0.8 + 0.5 * t) * 0.5;
    const lx = p.x - wHalf, rx = p.x + wHalf;
    verts.push(lx, edgeY(lx, p.z, t), p.z, rx, edgeY(rx, p.z, t), p.z);
    uvs.push(0, t * 4, 1, t * 4);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  // Senkrechter Fall vom Hang-Knie in den See
  const kp = curve.getPoint(1.0);
  const kneeY = hFn(kp.x, kp.z) + 0.15;
  const K = 26, FW = 3.4;
  const fverts = [], fuvs = [], fidx = [];
  for (let i = 0; i <= K; i++) {
    const k = i / K;
    const y = kneeY + (0.35 - kneeY) * Math.pow(k, 0.9);
    const z = kp.z + 2.1 * k * k;   // Unterkante biegt Richtung See aus
    const wHalf = FW * (0.75 + 0.5 * k) * 0.5;
    fverts.push(kp.x - wHalf, y, z, kp.x + wHalf, y, z);
    fuvs.push(0, 4 + k * 6, 1, 4 + k * 6);
  }
  for (let i = 0; i < K; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    fidx.push(a, c, b, b, c, d);
  }
  verts.push(...fverts); uvs.push(...fuvs); idx.push(...fidx.map(v => v + (N + 1) * 2));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      void main(){
        float stripe = sin(vUv.y*28.0 - uTime*9.0)*0.5+0.5;
        float stripe2 = sin(vUv.y*13.0 - uTime*6.0 + vUv.x*4.0)*0.5+0.5;
        vec3 col = mix(vec3(0.62,0.88,0.94), vec3(1.0,1.0,1.0), stripe*0.6 + stripe2*0.35);
        float edge = smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x);
        gl_FragColor = vec4(col, 0.97*edge + 0.03);
      }`,
  });
  const fall = new THREE.Mesh(g, mat);
  fall.name = 'waterfall';
  group.add(fall);

  // Gischt am Aufprall
  const foamGeo = new THREE.CircleGeometry(3.2, 24);
  foamGeo.rotateX(-Math.PI / 2);
  const foamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      void main(){
        float r = length(vUv);
        float ring = smoothstep(0.15,0.0,abs(r - (0.35+0.3*sin(uTime*2.2)))) + smoothstep(0.1,0.0,abs(r-0.75));
        float a = clamp(ring,0.0,1.0)*0.8 + smoothstep(0.55,0.0,r)*0.5;
        gl_FragColor = vec4(0.95,1.0,1.0,a);
      }`,
  });
  const foam = new THREE.Mesh(foamGeo, foamMat);
  foam.position.set(kp.x, 0.96, kp.z + 2.0);
  foam.name = 'waterfallFoam';
  group.add(foam);
  group.userData.mats = [mat, foamMat];
  return group;
}

// Brunnenwasser: kleine Scheibe im Becken (Referenz zeigt gefüllten Brunnen)
export function buildFountainWater(heightFn) {
  const y = (heightFn ? heightFn(2, 6) : 2.65) + 1.62;
  const geo = new THREE.CircleGeometry(1.15, 20);
  geo.rotateX(-Math.PI / 2);
  const mat = waterMat({ shallow: 0x92e2ea, deep: 0x4fb9cf, center: 6, stripe: 0.16, amp: 0.03, spec: 0.9, origin: [2, 6] });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(2, y, 6);
  mesh.name = 'fountainWater';
  return mesh;
}

export function tickWater(root, t) {
  root.traverse(o => {
    if (o.material && o.material.uniforms && o.material.uniforms.uTime) {
      o.material.uniforms.uTime.value = t;
    }
  });
}
