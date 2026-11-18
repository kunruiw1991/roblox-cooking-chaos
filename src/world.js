/**
 * 3D Isometric Roblox Commercial Kitchen & Exterior Dining Room for Cooking Chaos.
 * - Beige ceramic tile kitchen floor + stainless floor drainage grates
 * - Golden honey-oak butcher-block counters surrounded by low half-walls
 * - Exterior dining room: purple cushioned booths, seated R6 diners, glowing pink cherry blossom trees,
 *   and a bright glowing neon "SUSHI" wall sign!
 * - Animated cutting cleavers, silver boiling pots & red saute pan, scrolling red serving conveyor belt,
 *   and pooled InstancedMesh 3D blocky fire, smoke, steam, foam & confetti!
 * - Ultra-low draw calls (~50 total including avatars & items).
 */

import * as THREE from '../vendor/three.module.min.js';
import { STATION_DEFS } from './config.js';
import { GeomBatcher, safeStdMat } from './geom_utils.js';
import { createSeatedDiner } from './avatars.js';

const _dummy = new THREE.Object3D();
const _tmpCol = new THREE.Color();

export function buildKitchenWorld(scene, textures) {
  const worldGroup = new THREE.Group();
  worldGroup.name = 'kitchen_world';
  scene.add(worldGroup);

  // ---------------- 1. FLOORS (2 Draw Calls) ----------------
  // Exterior dining wood floor (28 x 24)
  textures.diningFloor.repeat.set(9, 8);
  const diningFloorGeo = new THREE.PlaneGeometry(32, 26);
  const diningFloorMat = safeStdMat({ map: textures.diningFloor, roughness: 0.72, metalness: 0.04 });
  const diningFloor = new THREE.Mesh(diningFloorGeo, diningFloorMat);
  diningFloor.rotation.x = -Math.PI * 0.5;
  diningFloor.position.set(0, -0.02, -2.5);
  diningFloor.receiveShadow = true;
  worldGroup.add(diningFloor);

  // Interior kitchen beige ceramic tile floor (13.2 x 9.6)
  textures.kitchenTile.repeat.set(6.5, 4.8);
  const kitchenFloorGeo = new THREE.PlaneGeometry(13.2, 9.6);
  const kitchenFloorMat = safeStdMat({ map: textures.kitchenTile, roughness: 0.52, metalness: 0.06 });
  const kitchenFloor = new THREE.Mesh(kitchenFloorGeo, kitchenFloorMat);
  kitchenFloor.rotation.x = -Math.PI * 0.5;
  kitchenFloor.position.set(0, 0.0, 0);
  kitchenFloor.receiveShadow = true;
  worldGroup.add(kitchenFloor);

  // ---------------- 2. BATCHED ARCHITECTURE & PROPS (4 Draw Calls!) ----------------
  const matteB = new GeomBatcher(); // Painted wood, half-walls, purple booths, sakura trees, crate bodies & voxel icons
  const oakB = new GeomBatcher(); // Golden honey-oak butcher-block tops & cutting boards
  const steelB = new GeomBatcher(); // Stainless steel appliances, drains, sink, range hood, stove grates

  // Stainless metal drainage grates inlaid in the kitchen ceramic floor!
  const drainCoords = [
    [-3.5, -1.8],
    [3.5, -1.8],
    [-3.5, 2.0],
    [3.5, 2.0],
    [0.0, 2.2],
  ];
  for (const [dx, dz] of drainCoords) {
    steelB.box(1.15, 0.025, 0.42, dx, 0.012, dz, 0x94a3b8);
    for (let s = -4; s <= 4; s++) {
      matteB.box(0.055, 0.03, 0.32, dx + s * 0.11, 0.015, dz, 0x334155);
    }
  }

  // Low Half-Walls enclosing the rectangular kitchen (keeps dining room 100% visible!)
  const wallColor = 0xfef3c7; // warm cream wainscoting
  const trimColor = 0x92400e; // honey walnut trim
  // North half-wall behind ingredient crates (z = -4.9)
  matteB.box(13.6, 1.32, 0.28, 0, 0.66, -4.9, wallColor);
  matteB.box(13.8, 0.12, 0.38, 0, 1.35, -4.9, trimColor);
  // West half-wall behind cutting boards (x = -6.7)
  matteB.box(0.28, 1.32, 9.8, -6.7, 0.66, 0, wallColor);
  matteB.box(0.38, 0.12, 10.0, -6.7, 1.35, 0, trimColor);
  // East half-wall behind stoves (x = +6.7)
  matteB.box(0.28, 1.32, 9.8, 6.7, 0.66, 0, wallColor);
  matteB.box(0.38, 0.12, 10.0, 6.7, 1.35, 0, trimColor);
  // South low curb behind south counters (very low 0.72u so camera never occludes south counters!)
  matteB.box(13.6, 0.72, 0.24, 0, 0.36, 4.9, wallColor);
  matteB.box(13.8, 0.10, 0.32, 0, 0.74, 4.9, trimColor);

  // Corner wooden kitchen pillars (short stylish cafe columns)
  for (const [px, pz] of [[-6.7, -4.9], [6.7, -4.9], [-6.7, 4.9], [6.7, 4.9]]) {
    matteB.box(0.46, 1.55, 0.46, px, 0.775, pz, trimColor);
    matteB.box(0.54, 0.12, 0.54, px, 1.56, pz, 0xd97706);
  }

  // ---------------- KITCHEN STATIONS ----------------
  // Continuous under-counter cabinetry along North, West, East, South & Center Island
  const cabBody = 0x78350f;
  const cabPanel = 0x92400e;
  const kickToe = 0x334155;

  // North continuous counter base (crates sit along z = -4.0)
  matteB.box(11.4, 0.14, 1.42, 0, 0.07, -4.0, kickToe);
  matteB.box(11.4, 0.74, 1.48, 0, 0.50, -4.0, cabBody);
  oakB.box(11.6, 0.12, 1.58, 0, 0.92, -4.0, 0xffffff, 0, 0, 0, 0.55);

  // West continuous counter base (x = -5.8, z in [-3.1, +3.1])
  matteB.box(1.42, 0.14, 6.2, -5.8, 0.07, 0, kickToe);
  matteB.box(1.48, 0.74, 6.2, -5.8, 0.50, 0, cabBody);
  oakB.box(1.58, 0.12, 6.3, -5.8, 0.92, 0, 0xffffff, 0, 0, 0, 0.55);

  // East continuous stainless cooktop counter base (x = +5.8, z in [-3.1, +3.1])
  matteB.box(1.42, 0.14, 6.2, 5.8, 0.07, 0, kickToe);
  steelB.box(1.52, 0.84, 6.25, 5.8, 0.54, 0, 0xe2e8f0, 0, 0, 0, 0.5);

  // Center Butcher-Block Island (x in [-1.95, +1.95], z = 0)
  matteB.box(3.8, 0.14, 1.38, 0, 0.07, 0, kickToe);
  matteB.box(3.86, 0.74, 1.44, 0, 0.50, 0, cabPanel);
  oakB.box(4.0, 0.14, 1.56, 0, 0.92, 0, 0xffffff, 0, 0, 0, 0.55);

  // South continuous counter base (z = +4.0, x in [-5.5, +2.6] — conveyor occupies x = +2.8..+5.4)
  matteB.box(8.1, 0.14, 1.42, -1.45, 0.07, 4.0, kickToe);
  matteB.box(8.1, 0.74, 1.48, -1.45, 0.50, 4.0, cabBody);
  oakB.box(8.2, 0.12, 1.58, -1.45, 0.92, 4.0, 0xffffff, 0, 0, 0, 0.55);

  // Individual station details & moving meshes!
  const stationVisuals = new Map();
  const cleavers = [];
  const pots = [];

  for (const st of STATION_DEFS) {
    if (st.type === 'crate') {
      // Wooden ingredient crate sitting proudly on North counter with bright voxel icon on top!
      matteB.box(1.36, 0.34, 1.18, st.x, 1.12, st.z, 0xb45309);
      matteB.box(1.20, 0.24, 1.02, st.x, 1.18, st.z, 0xd97706);
      // Front colored badge strip
      const badgeColors = {
        raw_cucumber: 0x22c55e,
        raw_fish: 0xef4444,
        seaweed: 0x15803d,
        raw_rice: 0xf8fafc,
        raw_patty: 0x991b1b,
        bun: 0xf59e0b,
      };
      matteB.box(1.0, 0.22, 0.08, st.x, 0.55, st.z + 0.76, badgeColors[st.dispenseItem] || 0xfacc15);

      // 3D Voxel Ingredient Display Pile right inside/above each crate!
      const iy = 1.38;
      if (st.dispenseItem === 'raw_cucumber') {
        matteB.cyl(0.12, 0.12, 0.62, 10, st.x - 0.18, iy, st.z, 0x16a34a, 0, 0.2, Math.PI * 0.5);
        matteB.cyl(0.12, 0.12, 0.62, 10, st.x + 0.14, iy + 0.05, st.z + 0.12, 0x22c55e, 0, -0.3, Math.PI * 0.5);
        matteB.cyl(0.12, 0.12, 0.56, 10, st.x, iy + 0.16, st.z - 0.1, 0x15803d, 0, 0.5, Math.PI * 0.5);
      } else if (st.dispenseItem === 'raw_fish') {
        matteB.box(0.56, 0.20, 0.28, st.x - 0.05, iy + 0.06, st.z, 0xdc2626);
        matteB.box(0.20, 0.20, 0.10, st.x + 0.30, iy + 0.06, st.z, 0xb91c1c, 0, 0.4, 0);
        matteB.box(0.52, 0.08, 0.29, st.x - 0.05, iy, st.z, 0xfca5a5);
        matteB.box(0.06, 0.06, 0.30, st.x - 0.24, iy + 0.10, st.z, 0xffffff);
      } else if (st.dispenseItem === 'seaweed') {
        matteB.box(0.76, 0.08, 0.64, st.x, iy, st.z, 0x14532d);
        matteB.box(0.72, 0.08, 0.60, st.x + 0.04, iy + 0.09, st.z - 0.02, 0x166534, 0, 0.1, 0);
        matteB.box(0.68, 0.07, 0.58, st.x - 0.03, iy + 0.17, st.z + 0.02, 0x1b4332, 0, -0.08, 0);
      } else if (st.dispenseItem === 'raw_rice') {
        matteB.box(0.56, 0.42, 0.48, st.x, iy + 0.12, st.z, 0xfafaf9);
        matteB.cyl(0.20, 0.22, 0.10, 10, st.x, iy + 0.35, st.z, 0xdc2626);
        matteB.cyl(0.24, 0.16, 0.14, 10, st.x, iy + 0.44, st.z, 0xe7e5e4);
      } else if (st.dispenseItem === 'raw_patty') {
        matteB.cyl(0.26, 0.26, 0.11, 12, st.x - 0.18, iy, st.z + 0.06, 0x991b1b);
        matteB.cyl(0.26, 0.26, 0.11, 12, st.x + 0.18, iy, st.z - 0.06, 0xb91c1c);
        matteB.cyl(0.26, 0.26, 0.11, 12, st.x, iy + 0.12, st.z, 0xdc2626);
      } else if (st.dispenseItem === 'bun') {
        matteB.cyl(0.26, 0.26, 0.10, 12, st.x - 0.18, iy, st.z, 0xeab308);
        matteB.sphere(0.26, 10, 8, st.x - 0.18, iy + 0.07, st.z, 0xd97706, 1, 0.55, 1);
        matteB.cyl(0.26, 0.26, 0.10, 12, st.x + 0.20, iy, st.z + 0.06, 0xeab308);
        matteB.sphere(0.26, 10, 8, st.x + 0.20, iy + 0.07, st.z + 0.06, 0xd97706, 1, 0.55, 1);
      }
    } else if (st.type === 'board') {
      // Raised pale maple cutting board slab
      oakB.box(1.08, 0.07, 0.88, st.x, 1.02, st.z, 0xfef3c7, 0, 0, 0, 0.4);
      // Animated Chopping Cleaver (1 mesh per board)
      const cBatch = new GeomBatcher();
      cBatch.box(0.04, 0.22, 0.44, 0, 0.12, 0.08, 0xe2e8f0); // bright steel blade
      cBatch.box(0.05, 0.04, 0.44, 0, 0.02, 0.08, 0xf8fafc); // sharp edge
      cBatch.box(0.07, 0.08, 0.26, 0, 0.16, -0.24, 0x78350f); // wooden handle
      const cleaverMesh = new THREE.Mesh(
        cBatch.build(),
        safeStdMat({ vertexColors: true, roughness: 0.36, metalness: 0.2 })
      );
      cleaverMesh.position.set(st.x + (st.faceX ? 0.22 : 0.32), 1.09, st.z - 0.16);
      cleaverMesh.rotation.y = st.faceX ? Math.PI * 0.4 : 0.2;
      cleaverMesh.castShadow = true;
      worldGroup.add(cleaverMesh);
      cleavers.push({ id: st.id, mesh: cleaverMesh, baseY: 1.09, baseZ: cleaverMesh.position.z });
      stationVisuals.set(st.id, { cleaverMesh });
    } else if (st.type === 'trash') {
      // Red-rimmed commercial kitchen trash chute
      matteB.box(0.96, 0.14, 0.96, st.x, 1.02, st.z, 0xdc2626);
      matteB.box(0.74, 0.16, 0.74, st.x, 1.03, st.z, 0x1e293b);
    } else if (st.type === 'stove') {
      // Gas burner ring + red control knobs on West face
      matteB.cyl(0.46, 0.48, 0.05, 16, st.x, 0.99, st.z, 0x1e293b);
      matteB.torus(0.32, 0.035, 6, 16, st.x, 1.03, st.z, 0x38bdf8, Math.PI * 0.5, 0, 0);
      // Burner grates
      matteB.box(0.84, 0.03, 0.07, st.x, 1.04, st.z, 0x334155);
      matteB.box(0.07, 0.03, 0.84, st.x, 1.04, st.z, 0x334155);
      // Control knobs facing West into kitchen
      matteB.cyl(0.06, 0.06, 0.08, 10, st.x - 0.78, 0.74, st.z - 0.28, 0xef4444, 0, 0, Math.PI * 0.5);
      matteB.cyl(0.06, 0.06, 0.08, 10, st.x - 0.78, 0.74, st.z + 0.28, 0xef4444, 0, 0, Math.PI * 0.5);

      // Animated Pot or Red Saute Pan (1 mesh each!)
      const pBatch = new GeomBatcher();
      if (st.potStyle === 'pan') {
        // Red commercial saute pan!
        pBatch.cyl(0.40, 0.34, 0.16, 16, 0, 0.09, 0, 0xdc2626);
        pBatch.cyl(0.34, 0.30, 0.14, 14, 0, 0.11, 0, 0x334155);
        pBatch.box(0.42, 0.06, 0.09, -0.52, 0.14, 0, 0x1e293b);
      } else {
        // Silver commercial boiling pot with side loop handles!
        pBatch.cyl(0.38, 0.36, 0.38, 16, 0, 0.19, 0, 0xdbeafe);
        pBatch.cyl(0.33, 0.33, 0.34, 14, 0, 0.22, 0, 0x64748b);
        pBatch.box(0.10, 0.07, 0.16, 0, 0.28, -0.41, 0x334155);
        pBatch.box(0.10, 0.07, 0.16, 0, 0.28, 0.41, 0x334155);
      }
      const potMesh = new THREE.Mesh(
        pBatch.build(),
        safeStdMat({ vertexColors: true, roughness: 0.34, metalness: 0.2 })
      );
      potMesh.position.set(st.x, 1.05, st.z);
      potMesh.castShadow = true;
      worldGroup.add(potMesh);
      pots.push({ id: st.id, mesh: potMesh, baseY: 1.05, style: st.potStyle });
      stationVisuals.set(st.id, { potMesh });
    } else if (st.type === 'extinguisher_mount') {
      // Bright yellow/red safety pad on South-West corner
      matteB.box(0.95, 0.06, 0.95, st.x, 1.01, st.z, 0xfacc15);
      matteB.box(0.76, 0.07, 0.76, st.x, 1.02, st.z, 0xb91c1c);
    } else if (st.type === 'plate_stack') {
      // Decorative plate holder base + stacked plates under the top plate
      matteB.cyl(0.44, 0.44, 0.06, 16, st.x, 1.01, st.z, 0x38bdf8);
      for (let i = 0; i < 3; i++) {
        matteB.cyl(0.38, 0.30, 0.05, 14, st.x, 1.07 + i * 0.06, st.z, 0xffffff);
      }
    } else if (st.type === 'sink') {
      // Stainless steel commercial sink basin + soapy blue water + arched chrome faucet
      steelB.box(1.36, 0.10, 1.18, st.x, 1.00, st.z, 0xe2e8f0);
      matteB.box(1.06, 0.06, 0.84, st.x, 1.04, st.z, 0x38bdf8);
      steelB.cyl(0.05, 0.06, 0.48, 10, st.x, 1.24, st.z + 0.44, 0xe2e8f0);
      steelB.box(0.08, 0.08, 0.34, st.x, 1.46, st.z + 0.28, 0xe2e8f0);
      steelB.cyl(0.04, 0.04, 0.14, 8, st.x, 1.38, st.z + 0.14, 0xe2e8f0);
    } else if (st.type === 'conveyor') {
      // Stainless pass-through frame housing the Red Motorized Serving Conveyor Belt!
      steelB.box(2.7, 0.86, 1.56, st.x, 0.43, st.z, 0xcbd5e1);
      // Pass-through serving archway posts
      steelB.box(0.18, 1.5, 0.18, st.x - 1.25, 1.2, st.z + 0.66, 0xe2e8f0);
      steelB.box(0.18, 1.5, 0.18, st.x + 1.25, 1.2, st.z + 0.66, 0xe2e8f0);
      matteB.box(2.74, 0.22, 0.24, st.x, 1.92, st.z + 0.66, 0xdc2626);
    }
  }

  // ---------------- EXTERIOR DINING ROOM (Purple Booths, Cherry Blossoms, Neon SUSHI!) ----------------
  // North dining room feature back wall (z = -10.8) so neon SUSHI sign & cherry blossoms frame the top!
  matteB.box(28.0, 4.4, 0.5, 0, 2.2, -10.8, 0xfff7ed);
  matteB.box(28.0, 1.2, 0.58, 0, 0.6, -10.75, 0x7c2d12);
  // Decorative warm timber wall slats along back wall
  for (let wx = -12; wx <= 12; wx += 3.0) {
    matteB.box(0.24, 4.4, 0.62, wx, 2.2, -10.72, 0x92400e);
  }

  // 4 Purple Cushioned Dining Booths outside North & Side half-walls!
  const boothSpecs = [
    { x: -4.2, z: -7.8, rot: 0, diner: 'diner_0' },
    { x: 4.2, z: -7.8, rot: 0, diner: 'diner_1' },
    { x: -9.8, z: -2.2, rot: Math.PI * 0.5, diner: 'diner_2' },
    { x: 9.8, z: -2.2, rot: -Math.PI * 0.5, diner: 'diner_3' },
  ];
  const seatedDiners = [];

  for (const b of boothSpecs) {
    // Table
    matteB.box(2.1, 0.12, 1.2, b.x, 0.96, b.z, 0xd97706, 0, b.rot, 0);
    matteB.cyl(0.12, 0.26, 0.92, 10, b.x, 0.46, b.z, 0x334155);
    // Tabletop cute sushi plate & soy bottle
    matteB.cyl(0.26, 0.22, 0.05, 10, b.x - 0.35, 1.05, b.z, 0xffffff);
    matteB.cyl(0.06, 0.07, 0.18, 8, b.x + 0.42, 1.11, b.z, 0xdc2626);

    // Purple cushioned booth benches (North & South sides of table, or East/West for side booths)
    const dx = Math.sin(b.rot) * 1.15;
    const dz = Math.cos(b.rot) * 1.15;
    // Back booth bench (facing camera / table)
    matteB.box(2.2, 0.52, 0.72, b.x - dx, 0.26, b.z - dz, 0x6b21a8, 0, b.rot, 0);
    matteB.box(2.16, 0.16, 0.68, b.x - dx, 0.56, b.z - dz, 0x9333ea, 0, b.rot, 0);
    matteB.box(2.2, 0.92, 0.22, b.x - dx * 1.32, 0.88, b.z - dz * 1.32, 0x7e22ce, 0, b.rot, 0);
    // Front booth bench
    matteB.box(2.2, 0.52, 0.72, b.x + dx, 0.26, b.z + dz, 0x6b21a8, 0, b.rot, 0);
    matteB.box(2.16, 0.16, 0.68, b.x + dx, 0.56, b.z + dz, 0x9333ea, 0, b.rot, 0);

    // Place a cheerful blocky R6 diner sitting in the purple booth!
    const diner = createSeatedDiner(b.diner);
    diner.group.position.set(b.x - dx * 0.95, 0.12, b.z - dz * 0.95);
    diner.group.rotation.y = b.rot;
    worldGroup.add(diner.group);
    seatedDiners.push(diner);
  }

  // 4 Glowing Pink Cherry Blossom Trees framing the dining room!
  const treeCoords = [
    [-9.2, -7.8],
    [9.2, -7.8],
    [-9.8, 3.2],
    [9.8, 3.2],
  ];
  for (const [tx, tz] of treeCoords) {
    // Planter box
    matteB.box(1.5, 0.62, 1.5, tx, 0.31, tz, 0x78350f);
    matteB.box(1.3, 0.12, 1.3, tx, 0.64, tz, 0x3f2e21);
    // Trunk & angled branches
    matteB.cyl(0.20, 0.28, 2.3, 8, tx, 1.75, tz, 0x5c3a21);
    matteB.cyl(0.11, 0.16, 1.1, 7, tx - 0.38, 2.55, tz + 0.12, 0x5c3a21, 0, 0, 0.55);
    matteB.cyl(0.11, 0.16, 1.1, 7, tx + 0.38, 2.60, tz - 0.12, 0x5c3a21, 0, 0, -0.55);
    // Layered voxel sakura pink blossom canopy!
    matteB.box(2.1, 1.1, 2.0, tx, 3.35, tz, 0xf472b6);
    matteB.box(1.6, 0.9, 1.6, tx - 0.65, 3.05, tz + 0.35, 0xf9a8d4);
    matteB.box(1.5, 0.85, 1.5, tx + 0.68, 3.12, tz - 0.25, 0xfbcfe8);
    matteB.box(1.4, 0.75, 1.4, tx, 4.0, tz + 0.1, 0xfce7f3);
  }

  // Finalize static batched meshes (3 draw calls total!)
  const matteMesh = new THREE.Mesh(
    matteB.build(),
    safeStdMat({ vertexColors: true, roughness: 0.66, metalness: 0.05 })
  );
  matteMesh.receiveShadow = true;
  matteMesh.castShadow = true;
  worldGroup.add(matteMesh);

  const oakMesh = new THREE.Mesh(
    oakB.build(),
    safeStdMat({ map: textures.oakBlock, vertexColors: true, roughness: 0.52, metalness: 0.05 })
  );
  oakMesh.receiveShadow = true;
  oakMesh.castShadow = true;
  worldGroup.add(oakMesh);

  const steelMesh = new THREE.Mesh(
    steelB.build(),
    safeStdMat({ map: textures.stainless, vertexColors: true, roughness: 0.34, metalness: 0.2 })
  );
  steelMesh.receiveShadow = true;
  steelMesh.castShadow = true;
  worldGroup.add(steelMesh);

  // ---------------- 3. GLOWING NEON "SUSHI" SIGN & MARQUEE (2 Draw Calls) ----------------
  const neonGeo = new THREE.BoxGeometry(5.2, 2.3, 0.22);
  const neonMat = safeStdMat({
    map: textures.neonSushi,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: textures.neonSushi,
    emissiveIntensity: 0.88,
    roughness: 0.32,
    metalness: 0.08,
  });
  const neonSign = new THREE.Mesh(neonGeo, neonMat);
  neonSign.position.set(0, 2.55, -10.35);
  worldGroup.add(neonSign);

  const bannerGeo = new THREE.BoxGeometry(4.0, 0.95, 0.16);
  const bannerMat = safeStdMat({
    map: textures.bannerSign,
    emissive: new THREE.Color(0xfef08a),
    emissiveIntensity: 0.18,
    roughness: 0.44,
    metalness: 0.06,
  });
  const bannerSign = new THREE.Mesh(bannerGeo, bannerMat);
  bannerSign.position.set(-5.8, 2.75, -10.35);
  worldGroup.add(bannerSign);

  // ---------------- 4. RED MOTORIZED SERVING CONVEYOR BELT (1 Draw Call) ----------------
  textures.conveyor.repeat.set(2.4, 1);
  const beltGeo = new THREE.BoxGeometry(2.55, 0.12, 1.32);
  const beltMat = safeStdMat({ map: textures.conveyor, roughness: 0.48, metalness: 0.08 });
  const beltMesh = new THREE.Mesh(beltGeo, beltMat);
  beltMesh.position.set(3.9, 0.92, 4.0);
  beltMesh.receiveShadow = true;
  worldGroup.add(beltMesh);

  // ---------------- 5. INTERACTIVE STATION HIGHLIGHT & WALK TARGET RINGS (2 Draw Calls) ----------------
  const highlightGeo = new THREE.BoxGeometry(1.56, 0.12, 1.36);
  const highlightMat = safeStdMat({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.65,
    transparent: true,
    opacity: 0.42,
    roughness: 0.35,
    metalness: 0.05,
  });
  const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
  highlightMesh.visible = false;
  worldGroup.add(highlightMesh);

  const walkRingGeo = new THREE.RingGeometry(0.32, 0.48, 24);
  const walkRingMat = safeStdMat({
    color: 0x4ade80,
    emissive: 0x22c55e,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    roughness: 0.4,
    metalness: 0.0,
  });
  const walkRingMesh = new THREE.Mesh(walkRingGeo, walkRingMat);
  walkRingMesh.rotation.x = -Math.PI * 0.5;
  walkRingMesh.position.y = 0.04;
  walkRingMesh.visible = false;
  worldGroup.add(walkRingMesh);

  // ---------------- 6. INSTANCED VFX POOLS (3 Draw Calls Total, 0 Leaks!) ----------------
  // 6a. Blocky 3D Fire Pool (up to 36 cubes)
  const MAX_FIRE = 36;
  const fireGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
  const fireMat = safeStdMat({
    color: 0xffffff,
    emissive: 0xff5a1f,
    emissiveIntensity: 0.85,
    roughness: 0.4,
    metalness: 0.0,
  });
  const fireInst = new THREE.InstancedMesh(fireGeo, fireMat, MAX_FIRE);
  fireInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fireInst.frustumCulled = false;
  const firePalette = [0xef4444, 0xf97316, 0xfacc15];
  for (let i = 0; i < MAX_FIRE; i++) {
    _dummy.position.set(0, -100, 0);
    _dummy.scale.set(0.001, 0.001, 0.001);
    _dummy.updateMatrix();
    fireInst.setMatrixAt(i, _dummy.matrix);
    _tmpCol.setHex(firePalette[i % firePalette.length]);
    fireInst.setColorAt(i, _tmpCol);
  }
  fireInst.instanceMatrix.needsUpdate = true;
  fireInst.instanceColor.needsUpdate = true;
  worldGroup.add(fireInst);

  // 6b. Multi-Purpose Particle Pool: Smoke, Steam, White Extinguisher Foam, Dash Dust, Sink Bubbles (96)
  const MAX_PART = 96;
  const partGeo = new THREE.IcosahedronGeometry(0.16, 1);
  const partMat = safeStdMat({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.0,
    transparent: true,
    opacity: 0.86,
  });
  const partInst = new THREE.InstancedMesh(partGeo, partMat, MAX_PART);
  partInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  partInst.frustumCulled = false;
  const particles = [];
  for (let i = 0; i < MAX_PART; i++) {
    particles.push({ active: false, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, s0: 1, s1: 1, hex: 0xffffff });
    _dummy.position.set(0, -100, 0);
    _dummy.scale.set(0.001, 0.001, 0.001);
    _dummy.updateMatrix();
    partInst.setMatrixAt(i, _dummy.matrix);
    _tmpCol.setHex(0xffffff);
    partInst.setColorAt(i, _tmpCol);
  }
  partInst.instanceMatrix.needsUpdate = true;
  partInst.instanceColor.needsUpdate = true;
  worldGroup.add(partInst);

  // 6c. Serve Confetti Pool (40)
  const MAX_CONF = 40;
  const confGeo = new THREE.BoxGeometry(0.16, 0.16, 0.04);
  const confMat = safeStdMat({ color: 0xffffff, roughness: 0.45, metalness: 0.08 });
  const confInst = new THREE.InstancedMesh(confGeo, confMat, MAX_CONF);
  confInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  confInst.frustumCulled = false;
  const confetti = [];
  const confCols = [0xfacc15, 0x4ade80, 0x38bdf8, 0xf472b6, 0xfb923c];
  for (let i = 0; i < MAX_CONF; i++) {
    confetti.push({ active: false, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, life: 0, maxLife: 1 });
    _dummy.position.set(0, -100, 0);
    _dummy.scale.set(0.001, 0.001, 0.001);
    _dummy.updateMatrix();
    confInst.setMatrixAt(i, _dummy.matrix);
    _tmpCol.setHex(confCols[i % confCols.length]);
    confInst.setColorAt(i, _tmpCol);
  }
  confInst.instanceMatrix.needsUpdate = true;
  confInst.instanceColor.needsUpdate = true;
  worldGroup.add(confInst);

  let partCursor = 0;
  function spawnParticle(x, y, z, vx, vy, vz, hex, maxLife = 0.7, s0 = 0.7, s1 = 1.6) {
    const p = particles[partCursor];
    partCursor = (partCursor + 1) % MAX_PART;
    p.active = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = 0;
    p.maxLife = maxLife;
    p.s0 = s0;
    p.s1 = s1;
    p.hex = hex;
    _tmpCol.setHex(hex);
    partInst.setColorAt(partCursor === 0 ? MAX_PART - 1 : partCursor - 1, _tmpCol);
    partInst.instanceColor.needsUpdate = true;
  }

  function spawnConfettiBurst(x, y, z) {
    for (let i = 0; i < 20; i++) {
      const c = confetti[i % MAX_CONF];
      const ang = (i / 20) * Math.PI * 2;
      const spd = 1.6 + (i % 4) * 0.55;
      c.active = true;
      c.x = x;
      c.y = y;
      c.z = z;
      c.vx = Math.cos(ang) * spd;
      c.vy = 2.8 + (i % 3) * 0.9;
      c.vz = Math.sin(ang) * spd;
      c.rx = i * 0.5;
      c.ry = i * 0.7;
      c.life = 0;
      c.maxLife = 1.15;
    }
  }

  function updateVfx(dt, time, burningStoves) {
    // Scroll motorized red conveyor belt chevron texture
    textures.conveyor.offset.x = -(time * 0.55) % 1;

    // Gentle exterior diner idle bob & cheer
    for (let i = 0; i < seatedDiners.length; i++) {
      const d = seatedDiners[i];
      d.headMesh.rotation.y = Math.sin(time * 1.6 + i * 1.4) * 0.16;
      d.headMesh.position.y = 1.34 + Math.sin(time * 3.0 + i) * 0.025;
    }

    // Update 3D blocky fire cubes above every burning stove!
    let fIdx = 0;
    for (const st of burningStoves) {
      for (let k = 0; k < 12 && fIdx < MAX_FIRE; k++) {
        const phase = (time * 4.5 + k * 0.47) % 1.0;
        const ang = k * 1.9 + time * 3.0;
        const rad = (1 - phase) * 0.34;
        const fx = st.x + Math.cos(ang) * rad;
        const fy = 1.25 + phase * 1.25;
        const fz = st.z + Math.sin(ang) * rad;
        const sc = (1 - phase * 0.65) * (0.85 + 0.3 * Math.sin(time * 14 + k));
        _dummy.position.set(fx, fy, fz);
        _dummy.rotation.set(time * 3 + k, time * 4 + k, 0);
        _dummy.scale.set(sc, sc * 1.35, sc);
        _dummy.updateMatrix();
        fireInst.setMatrixAt(fIdx, _dummy.matrix);
        fIdx++;
      }
    }
    for (let i = fIdx; i < MAX_FIRE; i++) {
      _dummy.position.set(0, -100, 0);
      _dummy.scale.set(0.001, 0.001, 0.001);
      _dummy.updateMatrix();
      fireInst.setMatrixAt(i, _dummy.matrix);
    }
    fireInst.instanceMatrix.needsUpdate = true;

    // Update particle pool
    for (let i = 0; i < MAX_PART; i++) {
      const p = particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.set(0.001, 0.001, 0.001);
        _dummy.updateMatrix();
        partInst.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = p.life / p.maxLife;
      const sc = (p.s0 + (p.s1 - p.s0) * t) * (1 - t * 0.65);
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(t * 2, t * 3, 0);
      _dummy.scale.set(sc, sc, sc);
      _dummy.updateMatrix();
      partInst.setMatrixAt(i, _dummy.matrix);
    }
    partInst.instanceMatrix.needsUpdate = true;

    // Update confetti pool
    for (let i = 0; i < MAX_CONF; i++) {
      const c = confetti[i];
      if (!c.active) continue;
      c.life += dt;
      if (c.life >= c.maxLife) {
        c.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.set(0.001, 0.001, 0.001);
        _dummy.updateMatrix();
        confInst.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      c.vy -= 7.2 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      c.rx += 7.5 * dt;
      c.ry += 6.2 * dt;
      const sc = Math.max(0.01, 1 - c.life / c.maxLife);
      _dummy.position.set(c.x, c.y, c.z);
      _dummy.rotation.set(c.rx, c.ry, 0);
      _dummy.scale.set(sc, sc, sc);
      _dummy.updateMatrix();
      confInst.setMatrixAt(i, _dummy.matrix);
    }
    confInst.instanceMatrix.needsUpdate = true;
  }

  return {
    worldGroup,
    cleavers,
    pots,
    stationVisuals,
    highlightMesh,
    walkRingMesh,
    seatedDiners,
    spawnParticle,
    spawnConfettiBurst,
    updateVfx,
  };
}
