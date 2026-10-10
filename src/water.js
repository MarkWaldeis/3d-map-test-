// Wasser: Meer, See, Fluss, Wasserfall — stilisierter Look passend zum Referenzbild
import * as THREE from 'three';
import { WORLD, ZONES, RIVER } from './layout.js';
import { coastRadius, fbm } from './terrain.js';

const waterVert = /* glsl */`
  varying vec2 vUv;
  varying vec3 vPos;
  uniform float uTime;
  uniform float uWaveAmp;
  void main() {
    vUv = uv;
    vec3 p = position;
    float w = sin(p.x * 0.16 + uTime * 1.1) * cos(p.z * 0.13 + uTime * 0.9)
            + 0.6 * sin(p.x * 0.05 - uTime * 0.6 + p.z * 0.07);
    p.y += w * uWaveAmp;
    vPos = p;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const waterFrag = /* glsl */`
  varying vec2 vUv;
  varying vec3 vPos;
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform float uCenter;   // Distanz-Mitte für Tiefenverlauf
  uniform float uStripe;   // Wellenstreifen-Stärke
  void main() {
    float d = length(vPos.xz) / uCenter;
    vec3 col = mix(uShallow, uDeep, clamp(d * d * 1.15, 0.0, 1.0));
    // wandernde helle Streifen
    float s = sin(vPos.x * 0.55 + vPos.z * 0.35 + uTime * 1.4)
            * sin(vPos.z * 0.7 - uTime * 1.1 + vPos.x * 0.2);
    s = smoothstep(0.55, 0.95, s) * uStripe;
    // zweite, feinere Welle
    float s2 = sin(vPos.x * 1.3 - uTime * 1.9 + vPos.z * 1.1);
    s += smoothstep(0.86, 0.99, s2) * uStripe * 0.5;
    col += vec3(s);
    gl_FragColor = vec4(col, 1.0);
  }`;

function waterMat({ shallow, deep, center, stripe = 0.12, amp = 0.18 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color(shallow) },
      uDeep: { value: new THREE.Color(deep) },
      uCenter: { value: center },
      uStripe: { value: stripe },
      uWaveAmp: { value: amp },
    },
    vertexShader: waterVert,
    fragmentShader: waterFrag,
  });
}

export function buildSea() {
  const geo = new THREE.PlaneGeometry(340, 340, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const mat = waterMat({ shallow: 0x46c2cf, deep: 0x1571a0, center: 150, stripe: 0.13, amp: 0.22 });
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
  group.add(foamRing(th => coastRadius(th) + 0.4, WORLD.seaLevel + 0.06, 0.9, 0xffffff, 0.85));
  group.add(foamRing(th => coastRadius(th) + 2.6, WORLD.seaLevel + 0.05, 1.4, 0xdff6f8, 0.35));
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
  const mat = waterMat({ shallow: 0x54c8d8, deep: 0x2b8fb5, center: 26, stripe: 0.08, amp: 0.05 });
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
    verts.push(p.x - nx * wHalf, y, p.y - nz * wHalf);
    verts.push(p.x + nx * wHalf, y, p.y + nz * wHalf);
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
  const mat = waterMat({ shallow: 0x5fd0da, deep: 0x35a0c0, center: 60, stripe: 0.10, amp: 0.04 });
  // Fließrichtung entlang uv.y
  mat.fragmentShader = mat.fragmentShader.replace(
    'float s = sin(vPos.x * 0.55',
    'float s = sin(vUv.y * 2.2 - uTime * 3.0 + vUv.x) * 0.6 + sin(vPos.x * 0.55'
  );
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'river';
  return mesh;
}

export function buildWaterfall() {
  const group = new THREE.Group();
  // vom Bergspalt (z≈-24, h≈10.5) in den See (h≈0.95)
  const top = new THREE.Vector3(-2.5, 11.2, -25.5);
  const mid = new THREE.Vector3(-3.2, 5.5, -22.5);
  const bot = new THREE.Vector3(-3.8, 1.0, -19.5);
  const curve = new THREE.QuadraticBezierCurve3(top, mid, bot);
  const N = 40, W = 3.4;
  const verts = [], uvs = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    // seitlich in x-Richtung (Wasserfall läuft in z)
    const wHalf = W * (0.8 + 0.5 * t);
    verts.push(p.x - wHalf * 0.5, p.y, p.z);
    verts.push(p.x + wHalf * 0.5, p.y, p.z);
    uvs.push(0, t * 8, 1, t * 8);
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
  const mat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      void main(){
        float stripe = sin(vUv.y*28.0 - uTime*9.0)*0.5+0.5;
        float stripe2 = sin(vUv.y*13.0 - uTime*6.0 + vUv.x*4.0)*0.5+0.5;
        vec3 col = mix(vec3(0.55,0.82,0.9), vec3(0.95,1.0,1.0), stripe*0.65 + stripe2*0.3);
        float edge = smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x);
        gl_FragColor = vec4(col, 0.92*edge + 0.06);
      }`,
  });
  const fall = new THREE.Mesh(g, mat);
  fall.name = 'waterfall';
  group.add(fall);

  // Gischt am Aufprall
  const foamGeo = new THREE.CircleGeometry(2.6, 24);
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
  foam.position.set(bot.x, 1.0, bot.z);
  foam.name = 'waterfallFoam';
  group.add(foam);
  group.userData.mats = [mat, foamMat];
  return group;
}

export function tickWater(root, t) {
  root.traverse(o => {
    if (o.material && o.material.uniforms && o.material.uniforms.uTime) {
      o.material.uniforms.uTime.value = t;
    }
  });
}
