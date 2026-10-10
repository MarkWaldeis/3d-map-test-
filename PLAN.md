# Schwebende Fantasy-Insel – Objektplan (TRELLIS.2 Low-Poly GLBs)

Referenz: Marks Inselbild (`reference_map.jpg`). Stil: bunter, handgemalter Stylized-Low-Poly-Diorama-Look.
WICHTIG: Kein Wasser als GLB (kein Fluss, Wasserfall, Meer, Brunnenwasser). Wasser baut die Map-KI später.
Insel-Terrain/Boden ist ebenfalls NICHT enthalten – die Map-KI baut die Landschaft selbst.
Maßstab: 1.0 Einheit = Höhe eines Fachwerkhauses (Erdgeschoss + Dach).
Alle GLBs sind in den Einheitswürfel normalisiert (AABB −0.5…0.5, Y-up glTF) – beim Platzieren mit der Spalte „Größe (rel.)“ skalieren.

| # | id | Datei | Beschreibung | Anzahl / Platzierung | Größe (rel.) |
|---|----|-------|--------------|----------------------|--------------|
| 1 | windmill | `windmill.glb` | Holz-Windmühle mit Steinsockel, 4 Flügel | 1, Nordwest-Hügel | 1.6 |
| 2 | house_blue_roof | `house_blue_roof.glb` | Fachwerkhaus, blaues Schieferdach | ~5, um den Dorfplatz | 1.0 |
| 3 | house_red_roof | `house_red_roof.glb` | Fachwerkhaus, rotes Ziegeldach | ~3, Dorfzentrum | 1.0 |
| 4 | house_chimney | `house_chimney.glb` | Haus mit Steinschornstein (Rauch nicht modellieren) | 1–2, Dorf Nord | 1.1 |
| 5 | fountain_dry | `fountain_dry.glb` | Runder Steinbrunnen, leeres Becken (Wasser später füllen) | 1, Dorfplatz Mitte | 0.4 |
| 6 | castle | `castle.glb` | Steinburg mit Türmen und Mauern | 1, auf `cliff_rock_castle` Ost | 2.5 |
| 7 | cliff_rock_castle | `cliff_rock_castle.glb` | Felssockel unter der Burg | 1, Ost | 3.0 |
| 8 | bridge_stone | `bridge_stone.glb` | Steinbogenbrücke zur Burg | 1, Ost | 2.0 lang |
| 9 | bridge_wood | `bridge_wood.glb` | Kleine Holzbogenbrücke über Fluss | 2, West/Süd | 1.0 lang |
| 10 | pier_wood | `pier_wood.glb` | Holzsteg/Anlegestelle | 2, Süd-Ost Bucht | 1.5 lang |
| 11 | sailboat | `sailboat.glb` | Kleines Segelboot | 2, am Steg | 0.6 |
| 12 | rowboat | `rowboat.glb` | Ruderboot | 1, am Steg | 0.4 |
| 13 | barn_thatched | `barn_thatched.glb` | Scheune mit gelbem Strohdach | 1, Felder Süd-West | 0.9 |
| 14 | shed_wood | `shed_wood.glb` | Kleiner Holzschuppen | 1–2, Felder | 0.5 |
| 15 | field_wheat | `field_wheat.glb` | Weizenfeld-Parzelle mit Zaun | 2, Süd | 1.0 x 0.6 |
| 16 | field_vegetable | `field_vegetable.glb` | Gemüsebeet-Parzelle | 2, Süd | 1.0 x 0.6 |
| 17 | tree_pine | `tree_pine.glb` | Nadelbaum | 80+, Wald West/Nord | 0.8 |
| 18 | tree_round | `tree_round.glb` | Runder Laubbaum | ~25, verstreut | 0.7 |
| 19 | tree_autumn | `tree_autumn.glb` | Herbstbaum rot/orange | ~6, verstreut | 0.7 |
| 20 | crystal_purple | `crystal_purple.glb` | Lila Kristallgruppe | 3, Wald/Nordost | 0.3 |
| 21 | crystal_blue_ruins | `crystal_blue_ruins.glb` | Blaue Kristalle mit Steinruinen | 1, Westwald | 0.6 |
| 22 | rock_boulder | `rock_boulder.glb` | Felsbrocken (Set) | ~15, Ufer/Pfade | 0.2–0.4 |
| 23 | mountain_snowy_cave | `mountain_snowy_cave.glb` | Schneeberg mit Höhleneingang | 2–3, Nordrand | 4.0 |
| 24 | fence_wood | `fence_wood.glb` | Holzzaun-Segment | viele, Felder/Wege | 0.3 hoch, 0.6 lang |
| 25 | lamp_post | `lamp_post.glb` | Laternenpfahl | ~6, Dorfwege | 0.4 |
| 26 | signpost | `signpost.glb` | Wegweiser | 2–3, Kreuzungen | 0.3 |
| 27 | barrels_crates | `barrels_crates.glb` | Fässer + Kisten Gruppe | ~4, Steg/Dorf | 0.2 |
| 28 | flower_bush | `flower_bush.glb` | Blumenbusch bunt | viele, Wiesen | 0.15 |
| 29 | plaza_cobblestone_tile | `plaza_cobblestone_tile.glb` | Kopfsteinpflaster-Kachel | Dorfplatz (kachelbar) | 1.0 x 1.0 flach |

Nicht erzeugt: `island_terrain_chunk` (Insel-Terrain) – die Map-KI baut Boden/Landschaft selbst.
Pipeline je Objekt: generiertes Freistell-Bild (weiß, 3/4-Ansicht) → TRELLIS.2 (A100) → Low-Poly ~20k mit 2048-PBR-Texture-Bake → Drive-Ordner.
