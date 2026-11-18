/**
 * Cooking Chaos (Hot Wok Studios) — Core Game Configuration, Recipes, Stations & RNG Chef Classes.
 */

export const SAVE_KEY = 'roblox_cooking_chaos_save';

export const SHIFT_DURATION_SEC = 120; // 02:00 round match timer
export const STAR_THRESHOLDS = [90, 180, 280]; // Kid-friendly 1/2/3-star thresholds

export const CHOP_BASE_DURATION = 2.6; // seconds for automatic cleaver; 2.2x faster with active chop
export const COOK_BASE_DURATION = 3.8; // seconds on stove burner
export const SMOKE_DELAY_SEC = 3.0; // seconds after cooked before dark smoke & warning beep
export const FIRE_DELAY_SEC = 6.0; // seconds after cooked before stove catches 3D blocky fire
export const FIRE_SPREAD_SEC = 14.0; // seconds burning before spreading to adjacent stove
export const EXTINGUISH_DURATION = 1.25; // seconds of white foam spray to douse a fire

export const STATION_REACH = 2.45; // generous proximity reach for 5-6 yr olds on iPad

export const ITEMS = {
  raw_cucumber: { id: 'raw_cucumber', name: 'Raw Cucumber', short: 'Cucumber', icon: '🥒', chopTo: 'chopped_cucumber' },
  chopped_cucumber: { id: 'chopped_cucumber', name: 'Sliced Cucumber', short: 'Cucumber', icon: '🥒', plateable: true },
  raw_fish: { id: 'raw_fish', name: 'Raw Tuna', short: 'Tuna', icon: '🐟', chopTo: 'chopped_fish', cookTo: 'cooked_fish' },
  chopped_fish: { id: 'chopped_fish', name: 'Sliced Tuna', short: 'Tuna', icon: '🍣', plateable: true, cookTo: 'cooked_fish' },
  cooked_fish: { id: 'cooked_fish', name: 'Seared Tuna', short: 'Seared Tuna', icon: '🐠', plateable: true },
  seaweed: { id: 'seaweed', name: 'Seaweed Sheet', short: 'Nori', icon: '🌿', plateable: true },
  raw_rice: { id: 'raw_rice', name: 'Raw Rice', short: 'Rice', icon: '🌾', cookTo: 'cooked_rice' },
  cooked_rice: { id: 'cooked_rice', name: 'Steamed Rice', short: 'Rice', icon: '🍚', plateable: true },
  raw_patty: { id: 'raw_patty', name: 'Raw Patty', short: 'Patty', icon: '🥩', cookTo: 'cooked_patty' },
  cooked_patty: { id: 'cooked_patty', name: 'Grilled Patty', short: 'Patty', icon: '🍖', plateable: true },
  bun: { id: 'bun', name: 'Burger Bun', short: 'Bun', icon: '🍞', plateable: true },
  burnt: { id: 'burnt', name: 'Burnt Food', short: 'Burnt', icon: '💨' },
};

export const RECIPES = [
  {
    id: 'sushi_roll',
    name: 'Sushi Roll',
    icon: '🍣',
    reward: 45,
    patience: 68,
    ingredients: ['chopped_cucumber', 'cooked_rice', 'seaweed'],
    steps: [
      { id: 'chopped_cucumber', icon: '🥒', label: 'Chop' },
      { id: 'cooked_rice', icon: '🍚', label: 'Boil' },
      { id: 'seaweed', icon: '🌿', label: 'Nori' },
    ],
  },
  {
    id: 'tuna_roll',
    name: 'Tuna Roll',
    icon: '🍙',
    reward: 55,
    patience: 72,
    ingredients: ['chopped_fish', 'cooked_rice', 'seaweed'],
    steps: [
      { id: 'chopped_fish', icon: '🐟', label: 'Chop' },
      { id: 'cooked_rice', icon: '🍚', label: 'Boil' },
      { id: 'seaweed', icon: '🌿', label: 'Nori' },
    ],
  },
  {
    id: 'chef_burger',
    name: 'Chef Burger',
    icon: '🍔',
    reward: 50,
    patience: 62,
    ingredients: ['cooked_patty', 'bun'],
    steps: [
      { id: 'cooked_patty', icon: '🥩', label: 'Grill' },
      { id: 'bun', icon: '🍞', label: 'Bun' },
    ],
  },
  {
    id: 'sashimi_plate',
    name: 'Sashimi Plate',
    icon: '🍱',
    reward: 60,
    patience: 74,
    ingredients: ['chopped_cucumber', 'cooked_fish'],
    steps: [
      { id: 'chopped_cucumber', icon: '🥒', label: 'Chop' },
      { id: 'cooked_fish', icon: '🐠', label: 'Sear' },
    ],
  },
];

export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export const CHEF_CLASSES = [
  {
    id: 'novice_chopper',
    name: 'Novice Chopper',
    rarity: 'Common',
    color: '#22c55e',
    icon: '🔪',
    weight: 34,
    luckWeight: 18,
    perk: '+25% Chop Speed',
    chopMult: 1.25,
    speedMult: 1.0,
    patienceDrainMult: 1.0,
    instantChopChance: 0,
    burnSlowMult: 1.0,
    luckBonus: 0,
  },
  {
    id: 'dash_runner',
    name: 'Dash Runner',
    rarity: 'Uncommon',
    color: '#38bdf8',
    icon: '⚡',
    weight: 22,
    luckWeight: 20,
    perk: '+30% Move & Dash Speed',
    chopMult: 1.05,
    speedMult: 1.3,
    patienceDrainMult: 1.0,
    instantChopChance: 0,
    burnSlowMult: 1.0,
    luckBonus: 0,
  },
  {
    id: 'tip_saver',
    name: 'Tip Saver',
    rarity: 'Rare',
    color: '#a855f7',
    icon: '💰',
    weight: 18,
    luckWeight: 22,
    perk: '-35% Patience Drain',
    chopMult: 1.05,
    speedMult: 1.05,
    patienceDrainMult: 0.65,
    instantChopChance: 0,
    burnSlowMult: 1.0,
    luckBonus: 0,
  },
  {
    id: 'chop_master',
    name: 'Chop Master',
    rarity: 'Epic',
    color: '#f97316',
    icon: '⚔️',
    weight: 12,
    luckWeight: 18,
    perk: '+75% Chop Speed',
    chopMult: 1.75,
    speedMult: 1.08,
    patienceDrainMult: 0.92,
    instantChopChance: 0,
    burnSlowMult: 1.0,
    luckBonus: 0,
  },
  {
    id: 'sharp_slice',
    name: 'Sharp Slice',
    rarity: 'Legendary',
    color: '#facc15',
    icon: '✨',
    weight: 8,
    luckWeight: 13,
    perk: '35% Instant Chop',
    chopMult: 1.45,
    speedMult: 1.1,
    patienceDrainMult: 0.9,
    instantChopChance: 0.35,
    burnSlowMult: 1.0,
    luckBonus: 0.1,
  },
  {
    id: 'fireproof_pro',
    name: 'Fireproof Pro',
    rarity: 'Mythic',
    color: '#ef4444',
    icon: '🧯',
    weight: 6,
    luckWeight: 9,
    perk: '2x Slower Burn + 30% Luck',
    chopMult: 1.2,
    speedMult: 1.12,
    patienceDrainMult: 0.85,
    instantChopChance: 0.12,
    burnSlowMult: 2.0,
    luckBonus: 0.3,
  },
];

export const CLASS_BY_ID = Object.fromEntries(CHEF_CLASSES.map((c) => [c.id, c]));

export const ROLL_COST = 30;
export const LUCK_BOOST_COST = 40;

/**
 * Spatial Kitchen Layout (Closed rectangular isometric kitchen with low half-walls)
 * Walkable interior floor: x in [-4.85, +4.85], z in [-3.05, +3.05]
 * Center island obstacle: x in [-2.05, +2.05], z in [-0.82, +0.82]
 */
export const KITCHEN_BOUNDS = {
  minX: -4.85,
  maxX: 4.85,
  minZ: -3.05,
  maxZ: 3.05,
  islandMinX: -2.05,
  islandMaxX: 2.05,
  islandMinZ: -0.82,
  islandMaxZ: 0.82,
};

export const STATION_DEFS = [
  // North Wall: Ingredient Dispenser Crates (z = -4.0)
  { id: 'crate_cucumber', type: 'crate', dispenseItem: 'raw_cucumber', label: 'Cucumber Crate', x: -4.5, z: -4.0, faceZ: 1 },
  { id: 'crate_fish', type: 'crate', dispenseItem: 'raw_fish', label: 'Tuna Crate', x: -2.7, z: -4.0, faceZ: 1 },
  { id: 'crate_seaweed', type: 'crate', dispenseItem: 'seaweed', label: 'Seaweed Bin', x: -0.9, z: -4.0, faceZ: 1 },
  { id: 'crate_rice', type: 'crate', dispenseItem: 'raw_rice', label: 'Rice Sack', x: 0.9, z: -4.0, faceZ: 1 },
  { id: 'crate_patty', type: 'crate', dispenseItem: 'raw_patty', label: 'Patty Cooler', x: 2.7, z: -4.0, faceZ: 1 },
  { id: 'crate_bun', type: 'crate', dispenseItem: 'bun', label: 'Bun Basket', x: 4.5, z: -4.0, faceZ: 1 },

  // West Wall: Cutting Boards & Trash (x = -5.8)
  { id: 'board_w1', type: 'board', label: 'Cutting Board', x: -5.8, z: -2.0, faceX: 1 },
  { id: 'board_w2', type: 'board', label: 'Cutting Board', x: -5.8, z: 0.0, faceX: 1 },
  { id: 'trash_w', type: 'trash', label: 'Trash Bin', x: -5.8, z: 2.0, faceX: 1 },

  // Center Island: Cutting Board + Assembly Counter (z = 0.0)
  { id: 'board_c1', type: 'board', label: 'Center Board', x: -1.0, z: 0.0, faceZ: 1 },
  { id: 'prep_c2', type: 'counter', label: 'Plating Island', x: 1.0, z: 0.0, faceZ: 1 },

  // East Wall: Gas Cooktop Stoves with Pots & Pan (x = +5.8)
  { id: 'stove_1', type: 'stove', potStyle: 'pot', label: 'Boiling Pot', x: 5.8, z: -2.0, faceX: -1 },
  { id: 'stove_2', type: 'stove', potStyle: 'pot', label: 'Rice Cooker Pot', x: 5.8, z: 0.0, faceX: -1 },
  { id: 'stove_3', type: 'stove', potStyle: 'pan', label: 'Saute Pan', x: 5.8, z: 2.0, faceX: -1 },

  // South Wall: Fire Extinguisher, Clean Plates, Plating Counter, Sink, Serving Conveyor (z = +4.0)
  { id: 'extinguisher_mount', type: 'extinguisher_mount', label: 'Fire Extinguisher', x: -4.5, z: 4.0, faceZ: -1 },
  { id: 'plate_stack', type: 'plate_stack', label: 'Clean Plates', x: -2.5, z: 4.0, faceZ: -1 },
  { id: 'plating_s', type: 'counter', label: 'Plating Counter', x: -0.5, z: 4.0, faceZ: -1, startsWithPlate: true },
  { id: 'sink_s', type: 'sink', label: 'Wash Sink', x: 1.5, z: 4.0, faceZ: -1 },
  { id: 'conveyor_serve', type: 'conveyor', label: 'Serving Belt', x: 3.9, z: 4.0, faceZ: -1 },
];

export function matchCompletedRecipe(ingredients) {
  if (!ingredients || ingredients.length === 0) return null;
  const sorted = [...ingredients].sort();
  for (const r of RECIPES) {
    if (r.ingredients.length !== sorted.length) continue;
    const target = [...r.ingredients].sort();
    let ok = true;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== target[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return r;
  }
  return null;
}

export function canAddToPlate(plateIngredients, newItemId) {
  if (!ITEMS[newItemId] || !ITEMS[newItemId].plateable) return false;
  if (plateIngredients.includes(newItemId)) return false;
  const candidate = [...plateIngredients, newItemId];
  // Allow if candidate is a subset of at least one recipe
  return RECIPES.some((r) => candidate.every((ing) => r.ingredients.includes(ing)));
}
