// Layout-Daten der Insel — Positionen/Größen aus PLAN.md + reference_map.jpg
// Koordinaten: x+ = Osten, z+ = Süden, y = Höhe. Einheitsgröße K siehe assets.js.

export const WORLD = {
  size: 150,          // Terrain-Kachel in Welt-Einheiten
  islandRadius: 46,   // nomineller Inselradius
  seaLevel: 0,
  unitK: 5,           // Welt-Einheiten pro relativem Größenfaktor (1.0 = Fachwerkhaus-Höhe)
};

// Haupt-Regionen (werden auch für Scatter-Ausschlusszonen benutzt)
export const ZONES = {
  plaza:   { x: 2, z: 6, r: 9 },
  lake:    { x: -4, z: -15, r: 11.5 },
  beach:   { x: 11, z: 19, r: 13 },
  fields:  { x: -15, z: 22, r: 12 },
  village: { x: 2, z: 6, r: 15 },
  castleIslet: { x: 31, z: -9, r: 10 },
  windmillHill: { x: -26, z: -9, r: 9 },
  forestWest: { x0: -40, x1: -13, z0: -20, z1: 15 },
  forestNorth: { x0: -14, x1: 16, z0: -27, z1: -16 },
};

// Flussverlauf vom See bis zur Bucht (x,z) + Breite
export const RIVER = {
  pts: [[-5, -5], [-9, 0], [-10, 7], [-7, 14], [-1, 18], [6, 19], [13, 20], [19, 22.5], [25, 26], [29, 30]],
  width: 3.2,
  yStart: 0.75,   // Wasserspiegel am Seeauslauf
  yEnd: 0.02,     // am Meer
};

// Meeresarm zwischen Hauptinsel und Burg-Inselchen (unter der Steinbrücke)
export const CHANNEL = {
  pts: [[16, -1], [21, -5.5], [25.5, -10.5], [30, -15.5], [36, -21]],
};

// Wegenetz (nur Textur + Zaun-Orientierung)
export const PATHS = [
  // Dorf -> Windmühle
  [[-6, 4], [-14, 0], [-20, -4], [-25, -7]],
  // Dorf -> Felder/Scheune
  [[-3, 12], [-9, 15], [-14, 18]],
  // Dorf -> Steg/Bucht
  [[8, 10], [12, 14], [15, 17]],
  // Dorf -> Burgbrücke
  [[9, 2], [15, -2], [20, -6], [24, -8]],
  // Dorf -> See/Norden
  [[0, -2], [-2, -6]],
];

// Feste Platzierungen: [x, z, rotY(rad optional), sink]
export const PLACEMENTS = [
  { file: 'mountain_snowy_cave.glb', size: 4.0, at: [[-17, -29, 2.6], [3, -31, 0.4], [18, -25, -0.9]], sinkFrac: 0.34 },
  { file: 'cliff_rock_castle.glb', size: 3.0, at: [[31, -9, 0.3]], sinkFrac: 0.30 },
  { file: 'castle.glb', size: 2.5, at: [[31, -9, -0.5]], onTopOf: 'cliff_rock_castle.glb' },
  { file: 'bridge_stone.glb', size: 2.6, at: [[24.5, -9, 1.62]], yOverride: 2.6 },
  { file: 'bridge_wood.glb', size: 1.0, at: [[-9.4, 3.4, 0.35], [-4.4, 16.4, 1.2]] },
  { file: 'windmill.glb', size: 1.6, at: [[-27, -10, 0.3]] },

  { file: 'fountain_dry.glb', size: 0.4, at: [[2, 6, 0]] },
  { file: 'house_blue_roof.glb', size: 1.0, at: [[-7, 1.5, 0.5], [10, 0.5, -0.6], [11.5, 10, -1.2], [6.5, 15.5, 3.0], [-4.5, 14, 2.6], [5.5, 11.5, -2.3]] },
  { file: 'house_red_roof.glb', size: 1.0, at: [[-8.5, 10.5, 0.9], [0.5, 16.5, 3.3], [-2.5, -1.5, -0.25], [-1.5, 17.8, 2.9]] },
  { file: 'house_chimney.glb', size: 1.1, at: [[13, -4, -0.8], [-13, 4.5, 0.55]] },

  { file: 'plaza_cobblestone_tile.glb', size: 1.0, squash: [1.0, 0.16, 1.0], grid: { x0: -4.6, z0: 1.4, dx: 2.6, dz: 2.6, nx: 6, nz: 4, s: 0.6 } },

  { file: 'barn_thatched.glb', size: 0.9, at: [[-25, 17, 0.7]] },
  { file: 'shed_wood.glb', size: 0.5, at: [[-22.5, 22.5, -0.4], [-9, 16.5, 2.1]] },
  { file: 'field_wheat.glb', size: 1.0, at: [[-19, 22, 0.05], [-11, 25.5, 0.05]], squash: [1.0, 0.62, 1.0] },
  { file: 'field_vegetable.glb', size: 1.0, at: [[-19.5, 27.5, 0.05], [-11.5, 20, 0.05]], squash: [1.0, 0.62, 1.0] },

  { file: 'pier_wood.glb', size: 1.5, at: [[18.5, 25, -0.85], [27, 25, -0.5]], yOverride: 0.4 },
  { file: 'sailboat.glb', size: 0.6, at: [[20, 26.5, 0.5], [26, 24, -0.9]], water: true },
  { file: 'rowboat.glb', size: 0.4, at: [[18, 24.5, 1.2]], water: true },
  { file: 'barrels_crates.glb', size: 0.2, at: [[14.5, 19.5, 0.3], [4.5, 3.5, -1.1], [-1.5, 11.5, 2.2], [22.5, 18.5, 0.9]] },
  { file: 'lamp_post.glb', size: 0.4, at: [[-3.5, 4, 0], [7.5, 4.5, 0.8], [9, 12.5, 0], [-6, 9.5, 0], [1.5, 13.5, 0], [12, 6, 0]] },
  { file: 'signpost.glb', size: 0.3, at: [[-8.5, -1, 0.7], [5.5, 16.5, -0.4], [-15, 13.5, 1.9]] },
  { file: 'crystal_purple.glb', size: 0.5, at: [[33.5, -14, 0.6], [35.5, -10.5, -0.8], [32, -18.5, 1.7]] },
  { file: 'crystal_purple.glb', size: 0.9, at: [[12, -20, 0.9]] },
  { file: 'crystal_purple.glb', size: 0.5, at: [[-26, 12, 0.4]] },
  { file: 'crystal_blue_ruins.glb', size: 0.6, at: [[-31, 7, 0.9]] },
];

// Streuobjekte (instanced): pro Gebiet Anzahl + Ausschlüsse
export const SCATTER = [
  { file: 'tree_pine.glb', size: 0.8, count: 85, in: 'forestWest', jitter: 0.25 },
  { file: 'tree_pine.glb', size: 0.85, count: 32, in: 'forestNorth', jitter: 0.3 },
  { file: 'tree_round.glb', size: 0.7, count: 26, anywhere: true, jitter: 0.3 },
  { file: 'tree_autumn.glb', size: 0.7, count: 7, anywhere: true, near: [[-28, -2], [-20, 12], [-12, 7], [15, -6], [-3, 21], [8, -10], [-33, -6]], spread: 6 },
  { file: 'rock_boulder.glb', size: 0.3, count: 16, coast: true, jitter: 0.5 },
  { file: 'flower_bush.glb', size: 0.15, count: 46, anywhere: true, jitter: 0.4 },
];

// Zaunlinien (Segmente automatisch entlang der Linien)
export const FENCES = [
  // Felder einfassen
  [[-23, 19], [-23, 30], [-14, 31]],
  [[-14, 31], [-5, 28], [-5, 22]],
  [[-5, 22], [-14, 17], [-23, 19]],
  // Weg Dorf -> Felder, kurze Stücke
  [[-7, 13.5], [-11, 16]],
];
