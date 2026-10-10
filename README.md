# Schwebende Fantasy-Insel – 3D-Asset-Kit für die Map-KI

Dieses Paket enthält **29 low-poly GLB-Modelle** einer stilisierten Fantasy-Insel. Sie wurden mit **Microsoft TRELLIS.2** aus eigens generierten Referenzbildern erzeugt und für die Spiele-/Map-Entwicklung aufbereitet.

Bitte lies zusätzlich **`PLAN.md`** (Platzierung, relative Größen, Anzahl) und schau dir **`reference_map.jpg`** an (Original-Inselbild als Layout-Referenz). Eine Übersicht der Quellbilder liegt unter **`source_images_overview.png`**.

## Was enthalten ist

- 29 texturierte GLBs (~19–20k Dreiecke, PBR-Bake, 2048 Texturen, WebP in den GLBs)
- `PLAN.md` – Objektliste mit Platzierungshinweisen und relativen Größen
- `reference_map.jpg` – das Referenzbild der Insel
- `source_images_overview.png` – Kontaktbogen der generierten Einzelbilder

## Was NICHT enthalten ist (wichtig)

1. **Kein Wasser als GLB.** Flüsse, Meer, Wasserfall und Brunnenwasser musst du selbst bauen. Das Brunnen-Modell `fountain_dry.glb` hat bewusst ein **leeres Becken**, das du mit Wasser füllst.
2. **Kein Insel-Terrain / Boden.** Die Landschaft (Gras, Felsunterseite, Wege) ist nicht als Mesh dabei – bitte selbst erzeugen.
3. Die Burg (`castle.glb`) steht auf dem Felssockel `cliff_rock_castle.glb`.

## Koordinatensystem und Skalierung

Jedes Modell ist in den **Einheitswürfel** normalisiert:

- AABB ungefähr **−0.5 … +0.5** in X/Y/Z
- **Y-up** (glTF-Konvention)
- Ursprung in der Mitte der Bounding Box

Beim Platzieren **musst du jedes Objekt mit dem Faktor aus `PLAN.md` (Spalte „Größe (rel.)“) skalieren**. Maßstab: **1.0 = Höhe eines Fachwerkhauses**. Beispiel: `windmill` → Scale 1.6, `castle` → 2.5, `flower_bush` → 0.15.

## Dateiliste

| Datei | Dreiecke | Größe |
|-------|----------|-------|
| `barn_thatched.glb` | 19.835 | 2,4 MB |
| `barrels_crates.glb` | 19.776 | 1,7 MB |
| `bridge_stone.glb` | 19.306 | 1,7 MB |
| `bridge_wood.glb` | 19.966 | 1,6 MB |
| `castle.glb` | 19.630 | 2,1 MB |
| `cliff_rock_castle.glb` | 19.015 | 2,7 MB |
| `crystal_blue_ruins.glb` | 19.635 | 2,3 MB |
| `crystal_purple.glb` | 19.462 | 1,7 MB |
| `fence_wood.glb` | 19.572 | 1,2 MB |
| `field_vegetable.glb` | 19.374 | 2,5 MB |
| `field_wheat.glb` | 19.749 | 2,8 MB |
| `flower_bush.glb` | 19.385 | 1,6 MB |
| `fountain_dry.glb` | 18.860 | 1,8 MB |
| `house_blue_roof.glb` | 19.751 | 2,4 MB |
| `house_chimney.glb` | 19.743 | 2,0 MB |
| `house_red_roof.glb` | 19.463 | 2,1 MB |
| `lamp_post.glb` | 19.911 | 1,8 MB |
| `mountain_snowy_cave.glb` | 18.600 | 1,6 MB |
| `pier_wood.glb` | 18.815 | 1,6 MB |
| `plaza_cobblestone_tile.glb` | 19.455 | 1,3 MB |
| `rock_boulder.glb` | 19.345 | 1,5 MB |
| `rowboat.glb` | 19.959 | 1,8 MB |
| `sailboat.glb` | 19.434 | 1,7 MB |
| `shed_wood.glb` | 19.167 | 1,8 MB |
| `signpost.glb` | 19.085 | 1,5 MB |
| `tree_autumn.glb` | 19.022 | 3,5 MB |
| `tree_pine.glb` | 19.072 | 1,2 MB |
| `tree_round.glb` | 19.459 | 4,3 MB |
| `windmill.glb` | 19.348 | 1,9 MB |

## Hinweise für die Map-KI

- Platziere Instanzen laut `PLAN.md` (Anzahl und Region) und richte dich am Layout von `reference_map.jpg` aus.
- `plaza_cobblestone_tile.glb` ist als **kachelbares** Pflasterstück gedacht.
- Bäume (`tree_pine`, `tree_round`, `tree_autumn`) stark instanzieren (Wald West/Nord).
- Wasserflächen und Flussläufe selbst anlegen; Brücken (`bridge_stone`, `bridge_wood`) darüber legen.
- Burg: zuerst `cliff_rock_castle`, darauf `castle`.

Stilziel: bunter, handgemalter Stylized-Low-Poly-Diorama-Look wie im Referenzbild.
