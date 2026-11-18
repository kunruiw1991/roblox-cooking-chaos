/**
 * 1-Draw-Call Merged Voxel/Low-Poly Kitchen Items, Plated Dishes & Red Fire Extinguisher.
 * Every BufferGeometry is cached by key so zero geometries or textures leak during gameplay!
 */

import * as THREE from '../vendor/three.module.min.js';
import { GeomBatcher, safeStdMat } from './geom_utils.js';

let _itemMat = null;
function getItemMat() {
  if (!_itemMat) {
    _itemMat = safeStdMat({ vertexColors: true, roughness: 0.46, metalness: 0.1 });
    _itemMat.userData.shared = true;
  }
  return _itemMat;
}

const _geoCache = new Map();

function buildSingleItemBatch(b, id, yOff = 0) {
  switch (id) {
    case 'raw_cucumber':
      // Bright emerald green whole cucumber with ridges & stem
      b.cyl(0.11, 0.11, 0.64, 10, 0, yOff + 0.12, 0, 0x16a34a, 0, 0, Math.PI * 0.5);
      b.sphere(0.11, 8, 6, -0.32, yOff + 0.12, 0, 0x15803d);
      b.sphere(0.11, 8, 6, 0.32, yOff + 0.12, 0, 0x15803d);
      b.box(0.06, 0.05, 0.05, 0.39, yOff + 0.12, 0, 0x84cc16);
      break;

    case 'chopped_cucumber':
      // Crisp emerald cucumber medallions with pale green centers
      for (let i = 0; i < 4; i++) {
        const dx = (i - 1.5) * 0.14;
        const dz = (i % 2 === 0 ? -0.06 : 0.06);
        b.cyl(0.11, 0.11, 0.06, 10, dx, yOff + 0.04, dz, 0x16a34a);
        b.cyl(0.08, 0.08, 0.068, 10, dx, yOff + 0.04, dz, 0xbbf7d0);
      }
      break;

    case 'raw_fish':
      // Vivid crimson tuna fish with tail & silvery belly
      b.box(0.50, 0.18, 0.24, -0.04, yOff + 0.11, 0, 0xdc2626);
      b.box(0.46, 0.07, 0.25, -0.04, yOff + 0.05, 0, 0xfca5a5);
      b.box(0.18, 0.18, 0.08, 0.28, yOff + 0.11, 0, 0xb91c1c, 0, 0.4, 0);
      b.box(0.06, 0.06, 0.26, -0.20, yOff + 0.15, 0, 0xf8fafc);
      b.box(0.03, 0.03, 0.27, -0.21, yOff + 0.15, 0, 0x1e293b);
      break;

    case 'chopped_fish':
      // Vivid crimson sliced tuna sashimi strips
      for (let i = 0; i < 3; i++) {
        b.box(0.32, 0.08, 0.12, 0, yOff + 0.05, (i - 1) * 0.15, 0xef4444);
        b.box(0.30, 0.085, 0.03, 0, yOff + 0.05, (i - 1) * 0.15, 0xfecaca);
      }
      break;

    case 'cooked_fish':
      // Golden-coral seared tuna steak with crispy sear marks
      b.box(0.46, 0.13, 0.30, 0, yOff + 0.08, 0, 0xfb7185);
      b.box(0.48, 0.04, 0.32, 0, yOff + 0.14, 0, 0xea580c);
      b.box(0.04, 0.02, 0.28, -0.12, yOff + 0.16, 0, 0x7c2d12);
      b.box(0.04, 0.02, 0.28, 0.0, yOff + 0.16, 0, 0x7c2d12);
      b.box(0.04, 0.02, 0.28, 0.12, yOff + 0.16, 0, 0x7c2d12);
      break;

    case 'seaweed':
      // Crisp dark emerald nori sheets stacked neatly
      b.box(0.48, 0.03, 0.44, 0, yOff + 0.025, 0, 0x14532d);
      b.box(0.46, 0.03, 0.42, 0.02, yOff + 0.055, -0.01, 0x166534);
      b.box(0.45, 0.025, 0.41, -0.01, yOff + 0.082, 0.01, 0x1b4332);
      break;

    case 'raw_rice':
      // Plump white grain rice sack tied with red ribbon
      b.box(0.38, 0.34, 0.32, 0, yOff + 0.17, 0, 0xf5f5f4);
      b.cyl(0.14, 0.16, 0.07, 10, 0, yOff + 0.35, 0, 0xdc2626);
      b.cyl(0.18, 0.11, 0.11, 10, 0, yOff + 0.42, 0, 0xe7e5e4);
      break;

    case 'cooked_rice':
      // Fluffy dome of bright white steamed rice
      b.sphere(0.24, 10, 8, 0, yOff + 0.10, 0, 0xffffff, 1.15, 0.72, 1.15);
      b.sphere(0.14, 8, 6, 0.06, yOff + 0.20, 0.04, 0xf8fafc, 1.0, 0.65, 1.0);
      break;

    case 'raw_patty':
      // Seasoned raw beef burger patty
      b.cyl(0.24, 0.24, 0.11, 14, 0, yOff + 0.06, 0, 0xb91c1c);
      b.cyl(0.20, 0.20, 0.115, 12, 0, yOff + 0.06, 0, 0xdc2626);
      break;

    case 'cooked_patty':
      // Rich seared brown burger patty with grill marks
      b.cyl(0.24, 0.24, 0.11, 14, 0, yOff + 0.06, 0, 0x713f12);
      b.box(0.34, 0.02, 0.04, 0, yOff + 0.12, -0.08, 0x451a03);
      b.box(0.36, 0.02, 0.04, 0, yOff + 0.12, 0.0, 0x451a03);
      b.box(0.34, 0.02, 0.04, 0, yOff + 0.12, 0.08, 0x451a03);
      break;

    case 'bun':
      // Golden toasted burger bun with sesame seeds
      b.cyl(0.25, 0.25, 0.09, 14, 0, yOff + 0.05, 0, 0xeab308);
      b.sphere(0.25, 10, 8, 0, yOff + 0.10, 0, 0xd97706, 1.0, 0.56, 1.0);
      b.box(0.04, 0.02, 0.02, -0.08, yOff + 0.23, 0.05, 0xfef9c3);
      b.box(0.04, 0.02, 0.02, 0.08, yOff + 0.23, 0.04, 0xfef9c3);
      b.box(0.04, 0.02, 0.02, 0.0, yOff + 0.24, -0.07, 0xfef9c3);
      break;

    case 'burnt':
      b.sphere(0.22, 8, 6, 0, yOff + 0.12, 0, 0x334155, 1.1, 0.7, 1.0);
      b.box(0.24, 0.12, 0.20, 0.06, yOff + 0.18, -0.04, 0x1e293b);
      break;

    default:
      b.box(0.28, 0.18, 0.28, 0, yOff + 0.1, 0, 0xfbbf24);
      break;
  }
}

function buildPlateBase(b, dirty = false) {
  const outerCol = dirty ? 0xcbd5e1 : 0xffffff;
  const innerCol = dirty ? 0x94a3b8 : 0xf1f5f9;
  b.cyl(0.39, 0.30, 0.055, 18, 0, 0.03, 0, outerCol);
  b.cyl(0.28, 0.26, 0.02, 16, 0, 0.055, 0, innerCol);
  if (dirty) {
    // Brown food smudges on dirty plate
    b.cyl(0.09, 0.09, 0.015, 8, -0.08, 0.068, 0.05, 0x78350f);
    b.cyl(0.06, 0.06, 0.015, 8, 0.10, 0.068, -0.04, 0x92400e);
  }
}

function buildFinishedDish(b, dishId) {
  buildPlateBase(b, false);
  if (dishId === 'sushi_roll') {
    // 4 crisp cucumber maki sushi rolls on the plate + ginger & wasabi!
    const pts = [
      [-0.14, -0.10],
      [0.14, -0.10],
      [-0.14, 0.11],
      [0.14, 0.11],
    ];
    for (const [x, z] of pts) {
      b.cyl(0.11, 0.11, 0.14, 12, x, 0.13, z, 0x14532d); // nori wrap
      b.cyl(0.092, 0.092, 0.148, 12, x, 0.13, z, 0xffffff); // white rice
      b.cyl(0.045, 0.045, 0.155, 10, x, 0.13, z, 0x22c55e); // emerald cucumber core
    }
    b.sphere(0.05, 7, 6, 0.0, 0.09, 0.24, 0x84cc16); // wasabi dot
  } else if (dishId === 'tuna_roll') {
    // 4 vivid crimson tuna maki sushi rolls!
    const pts = [
      [-0.14, -0.10],
      [0.14, -0.10],
      [-0.14, 0.11],
      [0.14, 0.11],
    ];
    for (const [x, z] of pts) {
      b.cyl(0.11, 0.11, 0.14, 12, x, 0.13, z, 0x14532d);
      b.cyl(0.092, 0.092, 0.148, 12, x, 0.13, z, 0xffffff);
      b.cyl(0.05, 0.05, 0.156, 10, x, 0.13, z, 0xef4444); // vivid crimson tuna core
    }
    b.sphere(0.05, 7, 6, 0.0, 0.09, 0.24, 0xfda4af); // pickled ginger
  } else if (dishId === 'chef_burger') {
    // Iconic stacked Roblox Chef Burger: bottom bun, lettuce, patty, melted cheddar, sesame top bun!
    b.cyl(0.24, 0.24, 0.07, 14, 0, 0.095, 0, 0xeab308);
    b.cyl(0.26, 0.26, 0.035, 12, 0, 0.14, 0, 0x22c55e);
    b.cyl(0.24, 0.24, 0.09, 14, 0, 0.195, 0, 0x713f12);
    b.box(0.38, 0.03, 0.38, 0, 0.245, 0, 0xfacc15, 0, 0.4, 0);
    b.sphere(0.25, 10, 8, 0, 0.27, 0, 0xd97706, 1.0, 0.58, 1.0);
    b.box(0.04, 0.02, 0.02, -0.08, 0.40, 0.05, 0xfef9c3);
    b.box(0.04, 0.02, 0.02, 0.08, 0.40, 0.04, 0xfef9c3);
  } else if (dishId === 'sashimi_plate') {
    // Gourmet Sashimi Plate: crisp emerald cucumber bed + gleaming seared crimson tuna slices!
    b.cyl(0.11, 0.11, 0.05, 10, -0.15, 0.085, 0.0, 0x16a34a);
    b.cyl(0.11, 0.11, 0.05, 10, 0.15, 0.085, 0.0, 0x16a34a);
    b.cyl(0.08, 0.08, 0.056, 10, -0.15, 0.085, 0.0, 0xbbf7d0);
    b.cyl(0.08, 0.08, 0.056, 10, 0.15, 0.085, 0.0, 0xbbf7d0);
    for (let i = 0; i < 3; i++) {
      b.box(0.30, 0.08, 0.11, 0, 0.145, (i - 1) * 0.14, 0xfb7185, 0, 0.12, 0);
      b.box(0.28, 0.086, 0.03, 0, 0.145, (i - 1) * 0.14, 0xea580c, 0, 0.12, 0);
    }
  }
}

function buildExtinguisherGeo() {
  const b = new GeomBatcher();
  // Bright red fire extinguisher canister
  b.cyl(0.16, 0.16, 0.62, 14, 0, 0.31, 0, 0xdc2626);
  b.sphere(0.16, 10, 8, 0, 0.62, 0, 0xdc2626, 1, 0.6, 1);
  // White label band
  b.cyl(0.165, 0.165, 0.22, 14, 0, 0.34, 0, 0xf8fafc);
  b.cyl(0.168, 0.168, 0.05, 14, 0, 0.40, 0, 0xfacc15);
  // Silver valve & handle
  b.cyl(0.05, 0.06, 0.12, 10, 0, 0.72, 0, 0xcbd5e1);
  b.box(0.06, 0.05, 0.22, 0, 0.78, -0.06, 0x334155);
  // Black cone nozzle pointing forward (+Z)
  b.cyl(0.03, 0.03, 0.24, 8, 0, 0.70, 0.14, 0x1e293b, Math.PI * 0.5, 0, 0);
  b.cone(0.09, 0.18, 10, 0, 0.70, 0.32, 0x1e293b, -Math.PI * 0.5, 0, 0);
  return b.build();
}

export function getItemGeometry(cacheKey, spec) {
  if (_geoCache.has(cacheKey)) return _geoCache.get(cacheKey);
  let geo;
  if (spec.kind === 'extinguisher') {
    geo = buildExtinguisherGeo();
  } else if (spec.kind === 'plate') {
    const b = new GeomBatcher();
    if (spec.dishId) {
      buildFinishedDish(b, spec.dishId);
    } else if (spec.dirty) {
      buildPlateBase(b, true);
    } else {
      buildPlateBase(b, false);
      const ings = spec.ingredients || [];
      ings.forEach((ingId, idx) => {
        // Stack/offset partial ingredients neatly on plate
        const yOff = 0.06 + idx * 0.07;
        buildSingleItemBatch(b, ingId, yOff);
      });
    }
    geo = b.build();
  } else {
    const b = new GeomBatcher();
    buildSingleItemBatch(b, spec.itemId, 0);
    geo = b.build();
  }
  _geoCache.set(cacheKey, geo);
  return geo;
}

export function getSpecCacheKey(spec) {
  if (!spec) return '';
  if (spec.kind === 'extinguisher') return 'extinguisher';
  if (spec.kind === 'plate') {
    if (spec.dishId) return `dish:${spec.dishId}`;
    if (spec.dirty) return 'plate:dirty';
    const ings = [...(spec.ingredients || [])].sort().join('+');
    return `plate:${ings}`;
  }
  return `item:${spec.itemId}`;
}

/**
 * Reusable mesh helper: updates an existing Mesh's geometry in-place without allocating a new Mesh!
 */
export function createItemVisualMesh() {
  const geo = getItemGeometry('item:raw_cucumber', { kind: 'item', itemId: 'raw_cucumber' });
  const mesh = new THREE.Mesh(geo, getItemMat());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.visible = false;
  mesh.userData.cacheKey = 'item:raw_cucumber';
  return mesh;
}

export function syncItemVisualMesh(mesh, spec) {
  if (!spec) {
    mesh.visible = false;
    return;
  }
  const key = getSpecCacheKey(spec);
  if (mesh.userData.cacheKey !== key) {
    mesh.geometry = getItemGeometry(key, spec);
    mesh.userData.cacheKey = key;
  }
  mesh.visible = true;
}

/**
 * Pre-warms every core item, dish & extinguisher geometry at startup so runtime geometry count stays flat.
 */
export function prewarmItemGeometries() {
  const rawIds = [
    'raw_cucumber', 'chopped_cucumber', 'raw_fish', 'chopped_fish',
    'cooked_fish', 'seaweed', 'raw_rice', 'cooked_rice',
    'raw_patty', 'cooked_patty', 'bun', 'burnt',
  ];
  for (const id of rawIds) {
    getItemGeometry(`item:${id}`, { kind: 'item', itemId: id });
  }
  getItemGeometry('extinguisher', { kind: 'extinguisher' });
  getItemGeometry('plate:', { kind: 'plate', ingredients: [] });
  getItemGeometry('plate:dirty', { kind: 'plate', dirty: true });
  for (const dishId of ['sushi_roll', 'tuna_roll', 'chef_burger', 'sashimi_plate']) {
    getItemGeometry(`dish:${dishId}`, { kind: 'plate', dishId });
  }
}
