/**
 * Cooking Chaos (Hot Wok Studios) — Core 3D Kitchen Simulation, AI Sous-Chef & Shift Manager.
 */

import * as THREE from '../vendor/three.module.min.js';
import {
  CHEF_CLASSES,
  CHOP_BASE_DURATION,
  CLASS_BY_ID,
  COOK_BASE_DURATION,
  EXTINGUISH_DURATION,
  FIRE_DELAY_SEC,
  FIRE_SPREAD_SEC,
  ITEMS,
  KITCHEN_BOUNDS,
  LUCK_BOOST_COST,
  RECIPE_BY_ID,
  RECIPES,
  ROLL_COST,
  SAVE_KEY,
  SHIFT_DURATION_SEC,
  SMOKE_DELAY_SEC,
  STAR_THRESHOLDS,
  STATION_DEFS,
  STATION_REACH,
  canAddToPlate,
  matchCompletedRecipe,
} from './config.js';
import { KitchenAudio } from './audio.js';
import { createKitchenTextures } from './textures.js';
import { createChefAvatar } from './avatars.js';
import { createItemVisualMesh, prewarmItemGeometries, syncItemVisualMesh } from './items.js';
import { buildKitchenWorld } from './world.js';

export class CookingChaosGame {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.audio = new KitchenAudio();

    // Renderer (WebGL2, bright commercial studio tone mapping, fast lazy shader warm-up)
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;

    // Scene — bright warm restaurant studio lighting, ZERO fog washout!
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf6ead6);
    this.scene.fog = null;

    // Fixed Isometric Perspective Camera (zero automatic yaw rotation, zero roll!)
    this.camera = new THREE.PerspectiveCamera(36, 16 / 10, 0.5, 90);
    this.camYaw = 0; // strictly fixed isometric!
    this._setupLighting();

    // Prewarm cached voxel item geometries so steady-state geometry delta is 0!
    prewarmItemGeometries();

    // Build textures & 3D kitchen world
    this.textures = createKitchenTextures();
    this.world = buildKitchenWorld(this.scene, this.textures);

    // Player R6 Chef Avatar
    this.playerRig = createChefAvatar('chef_player');
    this.scene.add(this.playerRig.group);
    this.heldVisualMesh = createItemVisualMesh();
    this.playerRig.carrySocket.add(this.heldVisualMesh);

    // Friendly AI Sous-Chef Buddy (Chef Mochi — washes dirty plates & cheers!)
    this.sousRig = createChefAvatar('sous_chef');
    this.scene.add(this.sousRig.group);
    this.sousHeldMesh = createItemVisualMesh();
    this.sousRig.carrySocket.add(this.sousHeldMesh);

    // Pooled visual meshes for station items (1 per station) & sliding conveyor dishes (max 3)
    this.stations = [];
    this.stationById = new Map();
    for (const def of STATION_DEFS) {
      const mesh = createItemVisualMesh();
      mesh.position.set(def.x, def.type === 'stove' ? 1.24 : def.type === 'board' ? 1.06 : 1.0, def.z);
      this.scene.add(mesh);
      const st = {
        ...def,
        item: null,
        progress: 0,
        overcookTime: 0,
        onFire: false,
        fireSpreadTime: 0,
        extinguishProgress: 0,
        dirtyPlates: 0,
        cleanPlates: def.type === 'plate_stack' ? 4 : 0,
        washProgress: 0,
        visualMesh: mesh,
        chopSfxTimer: 0,
        sizzleTimer: 0,
        alarmTimer: 0,
      };
      this.stations.push(st);
      this.stationById.set(st.id, st);
    }

    // Sliding dishes along the motorized red serving conveyor belt (pooled, 0 leaks!)
    this.slidingDishes = [];
    for (let i = 0; i < 3; i++) {
      const m = createItemVisualMesh();
      this.scene.add(m);
      this.slidingDishes.push({ active: false, t: 0, dishId: null, mesh: m });
    }

    // Raycaster for 1-tap direct station tapping
    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._counterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.95);
    this._hitPt = new THREE.Vector3();

    // Inputs
    this.keys = new Set();
    this.scriptInput = { x: 0, z: 0 };
    this.touchInput = { x: 0, z: 0 };
    this.walkTarget = null;
    this.sprayBurstTimer = 0;
    this.activeChopHold = false;
    this.activeChopPulse = 0;

    // Persistent progression state
    this.totalCoins = 60;
    this.bestStars = 0;
    this.shiftsCompleted = 0;
    this.equippedClassId = 'novice_chopper';
    this.unlockedClasses = ['novice_chopper'];
    this.luckBoostActive = false;
    this.freeRolls = 1;
    this.sousChefAutoPrep = false;

    // Live shift state
    this.time = 0;
    this.rngSeed = 4242;
    this.shiftNumber = 1;
    this.shiftTimer = SHIFT_DURATION_SEC;
    this.shiftEnded = false;
    this.shiftCoins = 0;
    this.ordersServed = 0;
    this.streak = 0;
    this.peakTipMult = 1;
    this.orders = [];
    this._nextOrderId = 1;
    this._orderSpawnTimer = 0;
    this._pendingDirtyReturns = [];

    // Player physics & carry state
    this.player = {
      x: 0,
      z: 2.1,
      yaw: Math.PI, // facing North toward crates & island
      speed: 0,
      dashTimer: 0,
      dashCooldown: 0,
      held: null,
      nearestStation: null,
      actionLabel: 'PICK UP',
    };

    // Sous-chef buddy state (stands neatly near South-East sink area & helps wash dirty plates!)
    this.sousChef = {
      x: 1.5,
      z: 2.55,
      yaw: 0,
      cheerTimer: 0,
      holdingPlate: false,
      state: 'idle',
    };

    // Gacha wheel animation state
    this.gacha = {
      spinning: false,
      timer: 0,
      duration: 1.8,
      resultClassId: null,
      lastTickIdx: -1,
    };

    this._loadSave();
    this.startShift(false);
    this.resize();
  }

  _setupLighting() {
    const hemi = new THREE.HemisphereLight(0xfffdf5, 0xd8c3a5, 1.38);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfffaf0, 1.48);
    sun.position.set(5.5, 19.0, 10.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0007;
    this.scene.add(sun);

    // Subtle warm sakura dining-room fill from North-West
    const fill = new THREE.DirectionalLight(0xfbcfe8, 0.44);
    fill.position.set(-9, 10, -12);
    this.scene.add(fill);
  }

  _rand() {
    this.rngSeed = (this.rngSeed * 1664525 + 1013904223) >>> 0;
    return this.rngSeed / 4294967296;
  }

  getActiveClass() {
    return CLASS_BY_ID[this.equippedClassId] || CHEF_CLASSES[0];
  }

  getTipMultiplier() {
    return Math.min(4, 1 + this.streak);
  }

  resize() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 800;
    this.renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    this.camera.aspect = aspect;

    // Frame the full rectangular kitchen + exterior dining booths & glowing SUSHI sign cleanly on all 6 viewports!
    if (aspect < 0.85) {
      // Portrait phone / portrait iPad
      this.camera.fov = aspect < 0.6 ? 52 : 44;
      this.camera.position.set(0, 18.8, 17.6);
      this.camera.lookAt(0, 0.2, -1.2);
    } else if (aspect < 1.38) {
      // iPad 4:3 (1024x768) / 1180x820
      this.camera.fov = 40;
      this.camera.position.set(0, 15.6, 14.6);
      this.camera.lookAt(0, 0.35, -1.2);
    } else {
      // Desktop 1280x800 & Landscape phone 844x390 — full glowing neon SUSHI sign + cherry blossoms cleanly in frame!
      this.camera.fov = 39;
      this.camera.position.set(0, 15.6, 14.9);
      this.camera.lookAt(0, 0.45, -1.6);
    }
    this.camera.rotation.z = 0;
    this.camera.updateProjectionMatrix();
  }

  _loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (typeof d.totalCoins === 'number' && Number.isFinite(d.totalCoins)) this.totalCoins = Math.max(0, Math.round(d.totalCoins));
      if (typeof d.bestStars === 'number') this.bestStars = Math.max(0, Math.min(3, d.bestStars));
      if (typeof d.shiftsCompleted === 'number') this.shiftsCompleted = Math.max(0, d.shiftsCompleted);
      if (d.equippedClassId && CLASS_BY_ID[d.equippedClassId]) this.equippedClassId = d.equippedClassId;
      if (Array.isArray(d.unlockedClasses)) {
        this.unlockedClasses = d.unlockedClasses.filter((id) => Boolean(CLASS_BY_ID[id]));
        if (!this.unlockedClasses.includes(this.equippedClassId)) this.unlockedClasses.push(this.equippedClassId);
      }
      if (typeof d.luckBoostActive === 'boolean') this.luckBoostActive = d.luckBoostActive;
      if (typeof d.freeRolls === 'number') this.freeRolls = Math.max(0, d.freeRolls);
      if (typeof d.sousChefAutoPrep === 'boolean') this.sousChefAutoPrep = d.sousChefAutoPrep;
      if (typeof d.musicOn === 'boolean') this.audio.setMusicOn(d.musicOn);
      if (typeof d.sfxOn === 'boolean') this.audio.setSfxOn(d.sfxOn);
    } catch (_) {}
  }

  _save() {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          totalCoins: this.totalCoins,
          bestStars: this.bestStars,
          shiftsCompleted: this.shiftsCompleted,
          equippedClassId: this.equippedClassId,
          unlockedClasses: this.unlockedClasses,
          luckBoostActive: this.luckBoostActive,
          freeRolls: this.freeRolls,
          sousChefAutoPrep: this.sousChefAutoPrep,
          musicOn: this.audio.musicOn,
          sfxOn: this.audio.sfxOn,
        })
      );
    } catch (_) {}
  }

  resetSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (_) {}
    this.totalCoins = 60;
    this.bestStars = 0;
    this.shiftsCompleted = 0;
    this.equippedClassId = 'novice_chopper';
    this.unlockedClasses = ['novice_chopper'];
    this.luckBoostActive = false;
    this.freeRolls = 1;
    this.sousChefAutoPrep = false;
    this.shiftNumber = 1;
    this.ui.closeModals();
    this.startShift(false);
    this._save();
  }

  startShift(nextShift = false) {
    if (nextShift) this.shiftNumber++;
    this.shiftTimer = SHIFT_DURATION_SEC;
    this.shiftEnded = false;
    this.shiftCoins = 0;
    this.ordersServed = 0;
    this.streak = 0;
    this.peakTipMult = 1;
    this.orders = [];
    this._orderSpawnTimer = 6.5;
    this._pendingDirtyReturns = [];

    // Reset player
    this.player.x = 0;
    this.player.z = 2.15;
    this.player.yaw = Math.PI;
    this.player.speed = 0;
    this.player.dashTimer = 0;
    this.player.dashCooldown = 0;
    this.player.held = null;
    this.walkTarget = null;
    this.sprayBurstTimer = 0;
    this.activeChopPulse = 0;

    // Reset all stations
    for (const st of this.stations) {
      st.item = null;
      st.progress = 0;
      st.overcookTime = 0;
      st.onFire = false;
      st.fireSpreadTime = 0;
      st.extinguishProgress = 0;
      st.dirtyPlates = 0;
      st.washProgress = 0;
      st.cleanPlates = st.type === 'plate_stack' ? 4 : 0;
      if (st.type === 'extinguisher_mount') {
        st.item = { kind: 'extinguisher' };
      } else if (st.startsWithPlate) {
        st.item = { kind: 'plate', ingredients: [], dishId: null, dirty: false };
      }
      syncItemVisualMesh(st.visualMesh, st.item);
    }

    for (const s of this.slidingDishes) {
      s.active = false;
      s.mesh.visible = false;
    }

    // Seed initial 2 iconic orders (Sushi Roll first, Chef Burger second!)
    this._spawnOrder('sushi_roll');
    this._spawnOrder('chef_burger');

    syncItemVisualMesh(this.heldVisualMesh, null);
    this.ui.dismissToast();
    this.ui.closeModals();
    this._syncStationVisuals();
    this._updateNearestStation();
    this._syncHud();
  }

  _spawnOrder(forcedRecipeId = null) {
    if (this.orders.length >= 4) return;
    let recipe;
    if (forcedRecipeId && RECIPE_BY_ID[forcedRecipeId]) {
      recipe = RECIPE_BY_ID[forcedRecipeId];
    } else {
      const idx = Math.floor(this._rand() * RECIPES.length);
      recipe = RECIPES[idx];
    }
    this.orders.push({
      uid: this._nextOrderId++,
      recipeId: recipe.id,
      timeLeft: recipe.patience,
      maxTime: recipe.patience,
    });
  }

  // ---------------- INPUT & TAP-TO-WALK ----------------
  setInput(x, z) {
    this.scriptInput.x = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
    this.scriptInput.z = Number.isFinite(z) ? Math.max(-1, Math.min(1, z)) : 0;
    if (Math.hypot(this.scriptInput.x, this.scriptInput.z) > 0.05) {
      this.cancelAutoWalk();
    }
  }

  cancelAutoWalk() {
    this.walkTarget = null;
    if (this.world && this.world.walkRingMesh) {
      this.world.walkRingMesh.visible = false;
    }
  }

  triggerDash() {
    if (this.shiftEnded || this.ui.activeModal) return false;
    if (this.player.dashCooldown > 0) return false;
    this.player.dashTimer = 0.26;
    this.player.dashCooldown = 0.95;
    this.audio.playDash();
    for (let i = 0; i < 6; i++) {
      this.world.spawnParticle(
        this.player.x + (this._rand() - 0.5) * 0.4,
        0.2,
        this.player.z + (this._rand() - 0.5) * 0.4,
        -Math.sin(this.player.yaw) * (1.2 + this._rand()),
        0.5 + this._rand() * 0.5,
        -Math.cos(this.player.yaw) * (1.2 + this._rand()),
        0xfef3c7,
        0.42,
        0.65,
        1.4
      );
    }
    return true;
  }

  _getStationStandPoint(st) {
    // Center island stations: stand cleanly on the chef's own side outside the island Z skin (±1.24)!
    if (Math.abs(st.z) < 0.5 && Math.abs(st.x) < 2.2) {
      const sideZ = this.player.z < 0 ? -1.44 : 1.44;
      return { x: st.x, z: sideZ };
    }
    const standX = Math.max(
      KITCHEN_BOUNDS.minX,
      Math.min(KITCHEN_BOUNDS.maxX, st.x + (st.faceX || 0) * 1.15)
    );
    const standZ = Math.max(
      KITCHEN_BOUNDS.minZ,
      Math.min(KITCHEN_BOUNDS.maxZ, st.z + (st.faceZ || 0) * 1.15)
    );
    return { x: standX, z: standZ };
  }

  _segmentHitsIsland(x0, z0, x1, z1) {
    // Slightly outside collision skin [-2.47, +2.47] x [-1.24, +1.24]
    const minX = KITCHEN_BOUNDS.islandMinX - 0.45;
    const maxX = KITCHEN_BOUNDS.islandMaxX + 0.45;
    const minZ = KITCHEN_BOUNDS.islandMinZ - 0.44;
    const maxZ = KITCHEN_BOUNDS.islandMaxZ + 0.44;
    const dx = x1 - x0;
    const dz = z1 - z0;
    let t0 = 0;
    let t1 = 1;
    const clip = (p, q) => {
      if (Math.abs(p) < 1e-8) return q >= 0;
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    };
    return (
      clip(-dx, x0 - minX) &&
      clip(dx, maxX - x0) &&
      clip(-dz, z0 - minZ) &&
      clip(dz, maxZ - z0) &&
      t0 <= t1
    );
  }

  _planWaypoints(gx, gz) {
    let px = this.player.x;
    let pz = this.player.z;
    // If chef's nose is pressed right against the island skin margin, nudge planning origin just outside
    if (px > KITCHEN_BOUNDS.islandMinX - 0.46 && px < KITCHEN_BOUNDS.islandMaxX + 0.46 &&
        pz > KITCHEN_BOUNDS.islandMinZ - 0.45 && pz < KITCHEN_BOUNDS.islandMaxZ + 0.45) {
      if (Math.abs(pz) >= Math.abs(px) * 0.5) {
        pz = pz < 0 ? -1.42 : 1.42;
      } else {
        px = px < 0 ? -2.62 : 2.62;
      }
    }
    if (!this._segmentHitsIsland(px, pz, gx, gz)) {
      return [{ x: gx, z: gz }];
    }
    // 6-node visibility shortest path around the center island corners (|x|=3.05, |z|=1.52)
    const nodes = [
      { x: px, z: pz },
      { x: -3.05, z: -1.52 },
      { x: 3.05, z: -1.52 },
      { x: -3.05, z: 1.52 },
      { x: 3.05, z: 1.52 },
      { x: gx, z: gz },
    ];
    const n = nodes.length;
    const dist = new Array(n).fill(Infinity);
    const prev = new Array(n).fill(-1);
    const vis = new Array(n).fill(false);
    dist[0] = 0;

    for (let iter = 0; iter < n; iter++) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < n; i++) {
        if (!vis[i] && dist[i] < best) {
          best = dist[i];
          u = i;
        }
      }
      if (u === -1 || u === n - 1) break;
      vis[u] = true;
      for (let v = 0; v < n; v++) {
        if (vis[v] || u === v) continue;
        if (this._segmentHitsIsland(nodes[u].x, nodes[u].z, nodes[v].x, nodes[v].z)) continue;
        const nd = dist[u] + Math.hypot(nodes[v].x - nodes[u].x, nodes[v].z - nodes[u].z);
        if (nd < dist[v]) {
          dist[v] = nd;
          prev[v] = u;
        }
      }
    }

    if (prev[n - 1] === -1) {
      // Fallback: step out to nearest clear East/West aisle then goal
      const sideX = px >= 0 ? 3.05 : -3.05;
      return [{ x: sideX, z: pz }, { x: sideX, z: gz }, { x: gx, z: gz }];
    }
    const path = [];
    let cur = n - 1;
    while (cur > 0) {
      path.push({ x: nodes[cur].x, z: nodes[cur].z });
      cur = prev[cur];
    }
    path.reverse();
    return path;
  }

  handleCanvasTap(clientX, clientY) {
    if (this.shiftEnded || this.ui.activeModal) return false;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    this._ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._ndc, this.camera);
    const hit = this._raycaster.ray.intersectPlane(this._counterPlane, this._hitPt);
    if (!hit) return false;

    // Find closest station within generous tap radius (1.85u)
    let best = null;
    let bestDist = 1.85;
    for (const st of this.stations) {
      const d = Math.hypot(st.x - this._hitPt.x, st.z - this._hitPt.z);
      if (d < bestDist) {
        bestDist = d;
        best = st;
      }
    }

    if (best) {
      const stand = this._getStationStandPoint(best);
      const curD = Math.hypot(this.player.x - best.x, this.player.z - best.z);
      const lineClear = !this._segmentHitsIsland(this.player.x, this.player.z, stand.x, stand.z);
      if (curD <= STATION_REACH - 0.1 && lineClear) {
        this.player.yaw = Math.atan2(best.x - this.player.x, best.z - this.player.z);
        this.player.nearestStation = best;
        return this.interactWithStation(best);
      }
      const waypoints = this._planWaypoints(stand.x, stand.z);
      const firstWp = waypoints[0];
      this.walkTarget = {
        x: stand.x,
        z: stand.z,
        waypoints,
        wpIdx: 0,
        stationId: best.id,
        timeLeft: 4.5,
        stuckTime: 0,
        lastDist: Math.hypot(firstWp.x - this.player.x, firstWp.z - this.player.z),
      };
      this.world.walkRingMesh.position.set(stand.x, 0.04, stand.z);
      this.world.walkRingMesh.visible = true;
      return true;
    }

    // Otherwise if tapped open walkable kitchen floor, walk there cleanly with short budget
    const fx = Math.max(KITCHEN_BOUNDS.minX, Math.min(KITCHEN_BOUNDS.maxX, this._hitPt.x));
    const fz = Math.max(KITCHEN_BOUNDS.minZ, Math.min(KITCHEN_BOUNDS.maxZ, this._hitPt.z));
    // Push floor tap cleanly out of island collision box if tapped on island edge
    const b = KITCHEN_BOUNDS;
    let gx = fx;
    let gz = fz;
    if (gx > b.islandMinX - 0.45 && gx < b.islandMaxX + 0.45 && gz > b.islandMinZ - 0.45 && gz < b.islandMaxZ + 0.45) {
      gz = this.player.z < 0 ? -1.44 : 1.44;
    }
    if (Math.hypot(gx - this.player.x, gz - this.player.z) > 0.5) {
      const waypoints = this._planWaypoints(gx, gz);
      const firstWp = waypoints[0];
      this.walkTarget = {
        x: gx,
        z: gz,
        waypoints,
        wpIdx: 0,
        stationId: null,
        timeLeft: 3.6,
        stuckTime: 0,
        lastDist: Math.hypot(firstWp.x - this.player.x, firstWp.z - this.player.z),
      };
      this.world.walkRingMesh.position.set(gx, 0.04, gz);
      this.world.walkRingMesh.visible = true;
      return true;
    }
    return false;
  }

  // ---------------- INTERACTION & STATION LOGIC ----------------
  _findNearestStation() {
    let best = null;
    let bestScore = Infinity;
    const fx = Math.sin(this.player.yaw);
    const fz = Math.cos(this.player.yaw);

    for (const st of this.stations) {
      const dx = st.x - this.player.x;
      const dz = st.z - this.player.z;
      const d = Math.hypot(dx, dz);
      if (d > STATION_REACH) continue;
      // Gentle facing bias so standing between 2 stations picks the one you face
      const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      const score = d - dot * 0.45;
      if (score < bestScore) {
        bestScore = score;
        best = st;
      }
    }
    return best;
  }

  _computeActionLabel(st) {
    const held = this.player.held;
    const anyFire = this.stations.some((s) => s.onFire);

    if (held && held.kind === 'extinguisher') {
      if (anyFire) return 'SPRAY FIRE!';
      if (st && (st.type === 'extinguisher_mount' || (st.type === 'counter' && !st.item))) return 'PLACE';
      return 'SPRAY FOAM';
    }
    if (!st) return held ? 'HOLDING' : 'ACTION';
    if (st.onFire) return 'FIRE! NEED EXT.';

    if (st.type === 'extinguisher_mount') {
      if (!held && st.item) return 'GRAB EXTINGUISHER';
      if (held && held.kind === 'extinguisher') return 'PUT BACK';
    }
    if (st.type === 'conveyor') {
      if (held && held.kind === 'plate' && held.dishId) return 'SERVE!';
      return 'SERVE BELT';
    }
    if (st.type === 'trash') {
      return held ? 'TOSS' : 'TRASH';
    }
    if (st.type === 'crate') {
      if (!held) return `GET ${ITEMS[st.dispenseItem].short.toUpperCase()}`;
      if (held.kind === 'plate' && !held.dirty && !held.dishId && canAddToPlate(held.ingredients, st.dispenseItem)) {
        return `ADD ${ITEMS[st.dispenseItem].short.toUpperCase()}`;
      }
      return 'CRATE';
    }
    if (st.type === 'board') {
      if (st.item && st.item.kind === 'item' && ITEMS[st.item.itemId]?.chopTo) {
        return 'CHOP!';
      }
      if (!held && st.item) return 'PICK UP';
      if (held && held.kind === 'item' && ITEMS[held.itemId]?.chopTo && !st.item) return 'CHOP';
      if (held && held.kind === 'plate' && !held.dirty && !held.dishId && st.item && st.item.kind === 'item' && canAddToPlate(held.ingredients, st.item.itemId)) {
        return 'PLATE';
      }
      if (held && !st.item) return 'PLACE';
      return 'BOARD';
    }
    if (st.type === 'stove') {
      if (held && held.kind === 'item' && ITEMS[held.itemId]?.cookTo && !st.item) return 'COOK';
      if (held && held.kind === 'plate' && !held.dirty && !held.dishId && st.item && st.item.kind === 'item' && canAddToPlate(held.ingredients, st.item.itemId)) {
        return 'SCOOP TO PLATE';
      }
      if (!held && st.item) return st.progress >= 1 || st.item.itemId === 'burnt' ? 'TAKE FOOD' : 'COOKING...';
      return 'STOVE';
    }
    if (st.type === 'plate_stack') {
      if (!held) return 'GET PLATE';
      if (held.kind === 'item' && ITEMS[held.itemId]?.plateable) return 'PLATE ITEM';
      return 'PLATES';
    }
    if (st.type === 'sink') {
      if (st.dirtyPlates > 0) return 'WASH DISH';
      if (held && held.kind === 'plate' && held.dirty) return 'PUT IN SINK';
      return 'SINK';
    }
    if (st.type === 'counter') {
      if (held && st.item && st.item.kind === 'plate' && !st.item.dirty && !st.item.dishId && held.kind === 'item' && canAddToPlate(st.item.ingredients, held.itemId)) {
        return 'PLATE';
      }
      if (held && held.kind === 'plate' && !held.dirty && !held.dishId && st.item && st.item.kind === 'item' && canAddToPlate(held.ingredients, st.item.itemId)) {
        return 'PLATE';
      }
      if (!held && st.item) return 'PICK UP';
      if (held && !st.item) return 'PLACE';
    }
    return 'ACTION';
  }

  _updateNearestStation() {
    const st = this._findNearestStation();
    this.player.nearestStation = st;
    this.player.actionLabel = this._computeActionLabel(st);

    if (st && !this.shiftEnded) {
      this.world.highlightMesh.visible = true;
      this.world.highlightMesh.position.set(st.x, 1.0, st.z);
      this.world.highlightMesh.material.color.setHex(st.onFire ? 0xef4444 : 0x38bdf8);
      this.world.highlightMesh.material.emissive.setHex(st.onFire ? 0xef4444 : 0x38bdf8);
    } else {
      this.world.highlightMesh.visible = false;
    }
  }

  _addIngredientToPlate(plate, itemId) {
    if (!canAddToPlate(plate.ingredients, itemId)) return false;
    plate.ingredients.push(itemId);
    const done = matchCompletedRecipe(plate.ingredients);
    if (done) {
      plate.dishId = done.id;
      this.audio.playDing();
      this.ui.showToast(`${done.icon} ${done.name} Ready! Serve on Red Belt!`, 2.2);
    } else {
      this.audio.playPop(1.2);
    }
    return true;
  }

  /**
   * Primary Action (E / Space / Big Green iPad ACTION button)
   */
  triggerPrimaryAction() {
    if (this.shiftEnded || this.ui.activeModal) return false;
    const held = this.player.held;
    const st = this._findNearestStation();

    // If holding extinguisher and any fire is active (or not placing back at mount), spray foam!
    if (held && held.kind === 'extinguisher') {
      const anyFire = this.stations.some((s) => s.onFire);
      if (anyFire) {
        return this.triggerSprayOrChop();
      }
      if (st && (st.type === 'extinguisher_mount' || (st.type === 'counter' && !st.item))) {
        return this.interactWithStation(st);
      }
      return this.triggerSprayOrChop();
    }

    if (!st) return false;
    return this.interactWithStation(st);
  }

  /**
   * Secondary Action (F / Hold Chop / Spray Fire Extinguisher)
   */
  triggerSprayOrChop() {
    if (this.shiftEnded || this.ui.activeModal) return false;
    if (this.player.held && this.player.held.kind === 'extinguisher') {
      this.sprayBurstTimer = 0.85;
      // Auto-face nearest burning stove within generous range for effortless kid aiming!
      const burning = this._nearestBurningStove(4.6);
      if (burning) {
        this.player.yaw = Math.atan2(burning.x - this.player.x, burning.z - this.player.z);
      }
      this.audio.playFoam();
      return true;
    }
    const st = this._findNearestStation();
    if (st && st.type === 'board' && st.item && st.item.kind === 'item' && ITEMS[st.item.itemId]?.chopTo) {
      this.activeChopPulse = 0.55;
      // Instant-chop chance on active strike for Sharp Slice class!
      const cls = this.getActiveClass();
      if (cls.instantChopChance > 0 && st.progress < 0.9 && this._rand() < cls.instantChopChance) {
        this._finishChop(st);
        this.ui.showToast('✨ SHARP SLICE INSTANT CHOP!', 1.5);
        return true;
      }
      this.audio.playChop();
      return true;
    }
    if (st && st.type === 'sink' && st.dirtyPlates > 0) {
      st.washProgress = Math.min(1, st.washProgress + 0.45);
      this.audio.playPop(1.3);
      return true;
    }
    return this.triggerPrimaryAction();
  }

  _nearestBurningStove(maxDist = 4.6) {
    let best = null;
    let bd = maxDist;
    for (const st of this.stations) {
      if (!st.onFire) continue;
      const d = Math.hypot(st.x - this.player.x, st.z - this.player.z);
      if (d < bd) {
        bd = d;
        best = st;
      }
    }
    return best;
  }

  _finishChop(st) {
    if (!st.item || st.item.kind !== 'item') return;
    const nextId = ITEMS[st.item.itemId]?.chopTo;
    if (!nextId) return;
    st.item.itemId = nextId;
    st.progress = 1;
    this.audio.playDing();
    syncItemVisualMesh(st.visualMesh, st.item);
  }

  interactWithStation(st) {
    if (!st) return false;
    const held = this.player.held;

    if (st.onFire) {
      if (held && held.kind === 'extinguisher') {
        return this.triggerSprayOrChop();
      }
      this.ui.showToast('🔥 Grab the Red Fire Extinguisher on South-West wall!', 2.2);
      this.audio.playAlarm(true);
      return false;
    }

    // 1. Extinguisher mount
    if (st.type === 'extinguisher_mount') {
      if (!held && st.item) {
        this.player.held = st.item;
        st.item = null;
        this.audio.playPop(0.95);
        this._syncStationVisuals();
        return true;
      }
      if (held && held.kind === 'extinguisher' && !st.item) {
        st.item = held;
        this.player.held = null;
        this.audio.playPop(0.85);
        this._syncStationVisuals();
        return true;
      }
      return false;
    }

    // 2. Ingredient Dispenser Crates
    if (st.type === 'crate') {
      if (!held) {
        this.player.held = { kind: 'item', itemId: st.dispenseItem };
        this.audio.playPop(1.05);
        this._syncStationVisuals();
        return true;
      }
      if (held.kind === 'plate' && !held.dirty && !held.dishId && canAddToPlate(held.ingredients, st.dispenseItem)) {
        this._addIngredientToPlate(held, st.dispenseItem);
        this._syncStationVisuals();
        return true;
      }
      return false;
    }

    // 3. Cutting Boards
    if (st.type === 'board') {
      // Active chop boost if already chopping
      if (st.item && st.item.kind === 'item' && ITEMS[st.item.itemId]?.chopTo) {
        this.activeChopPulse = 0.55;
        const cls = this.getActiveClass();
        if (cls.instantChopChance > 0 && st.progress < 0.9 && this._rand() < cls.instantChopChance) {
          this._finishChop(st);
          this.ui.showToast('✨ SHARP SLICE INSTANT CHOP!', 1.5);
          this._syncStationVisuals();
          return true;
        }
        this.audio.playChop();
        return true;
      }
      // Put down choppable or any item on empty board
      if (held && !st.item && held.kind !== 'extinguisher') {
        st.item = held;
        st.progress = 0;
        this.player.held = null;
        this.audio.playPop(0.92);
        // Check Sharp Slice instant chop right on drop!
        if (st.item.kind === 'item' && ITEMS[st.item.itemId]?.chopTo) {
          const cls = this.getActiveClass();
          if (cls.instantChopChance > 0 && this._rand() < cls.instantChopChance) {
            this._finishChop(st);
            this.ui.showToast('✨ SHARP SLICE INSTANT CHOP!', 1.5);
          }
        }
        this._syncStationVisuals();
        return true;
      }
      // Scoop chopped ingredient directly onto held plate!
      if (held && held.kind === 'plate' && !held.dirty && !held.dishId && st.item && st.item.kind === 'item' && canAddToPlate(held.ingredients, st.item.itemId)) {
        this._addIngredientToPlate(held, st.item.itemId);
        st.item = null;
        st.progress = 0;
        this._syncStationVisuals();
        return true;
      }
      // Pick up ready item from board
      if (!held && st.item) {
        this.player.held = st.item;
        st.item = null;
        st.progress = 0;
        this.audio.playPop(1.1);
        this._syncStationVisuals();
        return true;
      }
      return false;
    }

    // 4. Gas Cooktop Stoves
    if (st.type === 'stove') {
      if (held && held.kind === 'item' && ITEMS[held.itemId]?.cookTo && !st.item) {
        st.item = held;
        st.progress = 0;
        st.overcookTime = 0;
        st.onFire = false;
        this.player.held = null;
        this.audio.playSizzle();
        this._syncStationVisuals();
        return true;
      }
      // Scoop cooked item straight onto held plate!
      if (
        held &&
        held.kind === 'plate' &&
        !held.dirty &&
        !held.dishId &&
        st.item &&
        st.item.kind === 'item' &&
        st.progress >= 1 &&
        canAddToPlate(held.ingredients, st.item.itemId)
      ) {
        this._addIngredientToPlate(held, st.item.itemId);
        st.item = null;
        st.progress = 0;
        st.overcookTime = 0;
        this._syncStationVisuals();
        return true;
      }
      // Pick up cooked (or burnt) food from stove
      if (!held && st.item && (st.progress >= 1 || st.item.itemId === 'burnt')) {
        this.player.held = st.item;
        st.item = null;
        st.progress = 0;
        st.overcookTime = 0;
        this.audio.playPop(1.1);
        this._syncStationVisuals();
        return true;
      }
      return false;
    }

    // 5. Clean Plate Stack (never softlocks — always gives a fresh plate!)
    if (st.type === 'plate_stack') {
      if (!held) {
        if (st.cleanPlates > 0) st.cleanPlates--;
        this.player.held = { kind: 'plate', ingredients: [], dishId: null, dirty: false };
        this.audio.playPop(1.15);
        this._syncStationVisuals();
        return true;
      }
      if (held.kind === 'item' && ITEMS[held.itemId]?.plateable) {
        if (st.cleanPlates > 0) st.cleanPlates--;
        const plate = { kind: 'plate', ingredients: [], dishId: null, dirty: false };
        this._addIngredientToPlate(plate, held.itemId);
        this.player.held = plate;
        this._syncStationVisuals();
        return true;
      }
      return false;
    }

    // 6. Stainless Steel Sink
    if (st.type === 'sink') {
      if (held && held.kind === 'plate' && held.dirty) {
        st.dirtyPlates++;
        this.player.held = null;
        this.audio.playPop(0.9);
        this._syncStationVisuals();
        return true;
      }
      if (st.dirtyPlates > 0) {
        st.washProgress = Math.min(1, st.washProgress + 0.5);
        this.audio.playPop(1.25);
        return true;
      }
      return false;
    }

    // 7. Trash Bin
    if (st.type === 'trash') {
      if (!held) return false;
      if (held.kind === 'extinguisher') return false;
      if (held.kind === 'plate') {
        held.ingredients = [];
        held.dishId = null;
        this.audio.playPop(0.7);
      } else {
        this.player.held = null;
        this.audio.playPop(0.7);
      }
      this._syncStationVisuals();
      return true;
    }

    // 8. Serving Conveyor Belt
    if (st.type === 'conveyor') {
      if (held && held.kind === 'plate' && held.dishId) {
        this._serveDish(held.dishId);
        this.player.held = null;
        this._syncStationVisuals();
        return true;
      }
      this.ui.showToast('Plate a completed dish first before serving!', 1.8);
      return false;
    }

    // 9. General Plating / Assembly Counters
    if (st.type === 'counter') {
      // Combine held ingredient onto counter's plate
      if (held && held.kind === 'item' && st.item && st.item.kind === 'plate' && !st.item.dirty && !st.item.dishId) {
        if (this._addIngredientToPlate(st.item, held.itemId)) {
          this.player.held = null;
          this._syncStationVisuals();
          return true;
        }
      }
      // Combine counter's ingredient onto held plate
      if (held && held.kind === 'plate' && !held.dirty && !held.dishId && st.item && st.item.kind === 'item') {
        if (this._addIngredientToPlate(held, st.item.itemId)) {
          st.item = null;
          this._syncStationVisuals();
          return true;
        }
      }
      // Place held onto empty counter
      if (held && !st.item) {
        st.item = held;
        this.player.held = null;
        this.audio.playPop(0.95);
        this._syncStationVisuals();
        return true;
      }
      // Pick up from counter
      if (!held && st.item) {
        this.player.held = st.item;
        st.item = null;
        this.audio.playPop(1.08);
        this._syncStationVisuals();
        return true;
      }
    }

    return false;
  }

  _serveDish(dishId) {
    const recipe = RECIPE_BY_ID[dishId];
    if (!recipe) return;

    // Launch sliding 3D dish down the red motorized conveyor belt!
    const slot = this.slidingDishes.find((s) => !s.active) || this.slidingDishes[0];
    slot.active = true;
    slot.t = 0;
    slot.dishId = dishId;
    syncItemVisualMesh(slot.mesh, { kind: 'plate', dishId });
    slot.mesh.position.set(2.9, 1.0, 4.0);

    // Match most urgent active order for this dish
    let matchIdx = -1;
    let minLeft = Infinity;
    for (let i = 0; i < this.orders.length; i++) {
      if (this.orders[i].recipeId === dishId && this.orders[i].timeLeft < minLeft) {
        minLeft = this.orders[i].timeLeft;
        matchIdx = i;
      }
    }

    let payout;
    if (matchIdx >= 0) {
      this.orders.splice(matchIdx, 1);
      const currentMult = this.getTipMultiplier();
      const tipBonus = Math.round(recipe.reward * 0.25 * (currentMult - 1));
      payout = recipe.reward + tipBonus;
      this.streak++;
      const newMult = this.getTipMultiplier();
      if (newMult > this.peakTipMult) this.peakTipMult = newMult;
      this.ordersServed++;
      this._orderSpawnTimer = Math.min(this._orderSpawnTimer, 1.6);
      this.ui.showToast(`${recipe.icon} Served ${recipe.name}! +$${payout} (x${newMult} TIP!)`, 2.0);
    } else {
      // Off-menu dish still earns bonus coins so kids are always rewarded!
      payout = Math.round(recipe.reward * 0.6);
      this.ordersServed++;
      this.ui.showToast(`${recipe.icon} Bonus Dish Served! +$${payout}`, 1.8);
    }

    this.shiftCoins += payout;
    this.totalCoins += payout;
    this.sousChef.cheerTimer = 1.6;

    this.audio.playServe(this.getTipMultiplier());
    this.world.spawnConfettiBurst(3.9, 1.4, 4.0);
    this.ui.spawnFloatPop(`+$${payout}`, { x: 3.9, y: 1.9, z: 4.0 }, this.camera, window.innerWidth, window.innerHeight, '#facc15');

    // Return a dirty plate to sink in 3s
    this._pendingDirtyReturns.push(3.0);
    this._save();
  }

  _syncStationVisuals() {
    syncItemVisualMesh(this.heldVisualMesh, this.player.held);
    for (const st of this.stations) {
      syncItemVisualMesh(st.visualMesh, st.item);
    }
  }

  // ---------------- STEP LOOP ----------------
  step(dt = 1 / 60, n = 1) {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    for (let i = 0; i < n; i++) {
      this._stepOnce(safeDt);
    }
  }

  _stepOnce(dt) {
    this.time += dt;
    this.audio.stepMusic(dt);

    // Gacha wheel spin progression (works cleanly both live and via deterministic step())
    if (this.gacha.spinning) {
      this.gacha.timer += dt;
      const frac = Math.min(1, this.gacha.timer / this.gacha.duration);
      this.ui.updateGachaSpin(frac, this.gacha.resultClassId);
      const tickIdx = Math.floor(frac * 20);
      if (tickIdx !== this.gacha.lastTickIdx && frac < 0.98) {
        this.gacha.lastTickIdx = tickIdx;
        this.audio.playWheelTick(0.9 + frac * 0.4);
      }
      if (frac >= 1) {
        this.gacha.spinning = false;
        this._completeGachaRoll(this.gacha.resultClassId);
      }
    }

    if (this.shiftEnded || this.ui.activeModal) {
      this.world.updateVfx(dt, this.time, this.stations.filter((s) => s.onFire));
      this._syncHud();
      return;
    }

    // 1. Shift match timer
    this.shiftTimer = Math.max(0, this.shiftTimer - dt);
    if (this.shiftTimer <= 0) {
      this.finishShift();
      return;
    }

    // 2. Movement (Keyboard + Touch Thumbstick + Scripted Input + Cancellable Tap-to-Walk)
    this._updateMovement(dt);

    // 3. Stations (Chopping, Cooking, Overcooking/Fire, Fire Spread, Foam Spray, Sink Washing)
    this._updateStations(dt);

    // 4. Sliding conveyor dishes & Dirty Plate Returns
    this._updateConveyorAndSous(dt);

    // 5. Order Queue patience & spawning
    this._updateOrders(dt);

    // 6. Effects, nearest station highlight & HUD
    this.world.updateVfx(dt, this.time, this.stations.filter((s) => s.onFire));
    this._updateNearestStation();
    this.ui.tickTransient(dt);
    this._syncHud();
  }

  _updateMovement(dt) {
    let mx = this.scriptInput.x + this.touchInput.x;
    let mz = this.scriptInput.z + this.touchInput.z;

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz += 1;

    const manualLen = Math.hypot(mx, mz);
    if (manualLen > 0.05) {
      this.cancelAutoWalk();
      if (manualLen > 1) {
        mx /= manualLen;
        mz /= manualLen;
      }
    } else if (this.walkTarget) {
      this.walkTarget.timeLeft -= dt;
      const wps = this.walkTarget.waypoints && this.walkTarget.waypoints.length
        ? this.walkTarget.waypoints
        : [{ x: this.walkTarget.x, z: this.walkTarget.z }];
      let wpIdx = Math.min(this.walkTarget.wpIdx || 0, wps.length - 1);
      let wp = wps[wpIdx];
      let dx = wp.x - this.player.x;
      let dz = wp.z - this.player.z;
      let d = Math.hypot(dx, dz);

      // Advance intermediate corner waypoints cleanly when reached
      while (d <= 0.34 && wpIdx < wps.length - 1) {
        wpIdx++;
        this.walkTarget.wpIdx = wpIdx;
        wp = wps[wpIdx];
        dx = wp.x - this.player.x;
        dz = wp.z - this.player.z;
        d = Math.hypot(dx, dz);
        this.walkTarget.lastDist = d;
        this.walkTarget.stuckTime = 0;
      }

      if (this.walkTarget.timeLeft <= 0) {
        this.cancelAutoWalk();
      } else if (d <= 0.38 && wpIdx === wps.length - 1) {
        const stId = this.walkTarget.stationId;
        this.cancelAutoWalk();
        if (stId) {
          const st = this.stationById.get(stId);
          if (st) {
            this.player.yaw = Math.atan2(st.x - this.player.x, st.z - this.player.z);
            this.interactWithStation(st);
          }
        }
      } else {
        const tLen = Math.hypot(dx, dz) || 1;
        mx = dx / tLen;
        mz = dz / tLen;

        if (d > this.walkTarget.lastDist - 0.008) {
          this.walkTarget.stuckTime += dt;
          if (this.walkTarget.stuckTime > 0.55) {
            this.cancelAutoWalk();
            mx = 0;
            mz = 0;
          }
        } else {
          this.walkTarget.stuckTime = 0;
        }
        if (this.walkTarget) {
          this.walkTarget.lastDist = d;
        }
      }
    }

    if (this.player.dashTimer > 0) this.player.dashTimer = Math.max(0, this.player.dashTimer - dt);
    if (this.player.dashCooldown > 0) this.player.dashCooldown = Math.max(0, this.player.dashCooldown - dt);

    const cls = this.getActiveClass();
    const baseSpeed = 6.4 * cls.speedMult;
    const isDashing = this.player.dashTimer > 0;
    const moveMag = Math.hypot(mx, mz);

    if (moveMag > 0.02 || isDashing) {
      const dirX = moveMag > 0.02 ? mx / moveMag : Math.sin(this.player.yaw);
      const dirZ = moveMag > 0.02 ? mz / moveMag : Math.cos(this.player.yaw);
      const speed = isDashing ? 13.8 * cls.speedMult : baseSpeed * Math.min(1, moveMag);

      this._movePlayerWithCollision(dirX * speed * dt, dirZ * speed * dt);
      this.player.speed = speed;

      const targetYaw = Math.atan2(dirX, dirZ);
      let diff = targetYaw - this.player.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.player.yaw += diff * Math.min(1, dt * 16);
    } else {
      this.player.speed = 0;
    }

    this.playerRig.group.position.set(this.player.x, 0, this.player.z);
    this.playerRig.group.rotation.y = this.player.yaw;

    const held = this.player.held;
    this.playerRig.update(dt, this.player.speed, {
      carrying: Boolean(held && held.kind !== 'extinguisher'),
      holdingExtinguisher: Boolean(held && held.kind === 'extinguisher'),
      chopping: this.activeChopPulse > 0 || this.activeChopHold,
      dashing: isDashing,
    });

    if (this.world.walkRingMesh.visible) {
      const pulse = 1 + Math.sin(this.time * 8) * 0.12;
      this.world.walkRingMesh.scale.set(pulse, pulse, 1);
    }
  }

  _movePlayerWithCollision(dx, dz) {
    const r = 0.42;
    const b = KITCHEN_BOUNDS;
    const tryPos = (nx, nz) => {
      const cx = Math.max(b.minX, Math.min(b.maxX, nx));
      const cz = Math.max(b.minZ, Math.min(b.maxZ, nz));
      const inIsland =
        cx > b.islandMinX - r &&
        cx < b.islandMaxX + r &&
        cz > b.islandMinZ - r &&
        cz < b.islandMaxZ + r;
      if (inIsland) return null;
      return [cx, cz];
    };

    const full = tryPos(this.player.x + dx, this.player.z + dz);
    if (full) {
      this.player.x = full[0];
      this.player.z = full[1];
      return;
    }
    const slideX = tryPos(this.player.x + dx, this.player.z);
    if (slideX) {
      this.player.x = slideX[0];
      this.player.z = slideX[1];
      return;
    }
    const slideZ = tryPos(this.player.x, this.player.z + dz);
    if (slideZ) {
      this.player.x = slideZ[0];
      this.player.z = slideZ[1];
    }
  }

  _updateStations(dt) {
    const cls = this.getActiveClass();
    if (this.activeChopPulse > 0) this.activeChopPulse = Math.max(0, this.activeChopPulse - dt);
    if (this.sprayBurstTimer > 0) this.sprayBurstTimer = Math.max(0, this.sprayBurstTimer - dt);

    // Spraying Fire Extinguisher white foam!
    const isSpraying =
      this.player.held &&
      this.player.held.kind === 'extinguisher' &&
      (this.sprayBurstTimer > 0 || this.keys.has('KeyF'));

    if (isSpraying) {
      // Spawn dense white foam jet forward from extinguisher nozzle!
      const fx = Math.sin(this.player.yaw);
      const fz = Math.cos(this.player.yaw);
      const ox = this.player.x + fx * 0.95;
      const oz = this.player.z + fz * 0.95;
      for (let k = 0; k < 2; k++) {
        this.world.spawnParticle(
          ox + (this._rand() - 0.5) * 0.18,
          1.25 + (this._rand() - 0.5) * 0.15,
          oz + (this._rand() - 0.5) * 0.18,
          fx * (4.6 + this._rand() * 1.4) + (this._rand() - 0.5) * 0.9,
          0.35 + (this._rand() - 0.5) * 0.5,
          fz * (4.6 + this._rand() * 1.4) + (this._rand() - 0.5) * 0.9,
          0xf8fafc,
          0.42,
          0.65,
          1.75
        );
      }

      // Extinguish any burning stove within generous foam reach!
      for (const st of this.stations) {
        if (!st.onFire) continue;
        const d = Math.hypot(st.x - this.player.x, st.z - this.player.z);
        if (d <= 4.6) {
          st.extinguishProgress += dt / EXTINGUISH_DURATION;
          if (st.extinguishProgress >= 1.0) {
            st.onFire = false;
            st.extinguishProgress = 0;
            st.fireSpreadTime = 0;
            st.overcookTime = 0;
            st.item = null;
            st.progress = 0;
            syncItemVisualMesh(st.visualMesh, null);
            this.audio.playDing();
            this.ui.showToast('🧯 Fire Extinguished! Great save!', 2.2);
          }
        }
      }
    }

    // Per-station update: cutting boards, stoves, sink
    const stoveList = [];
    for (const st of this.stations) {
      // Cutting Boards
      if (st.type === 'board') {
        const vis = this.world.stationVisuals.get(st.id);
        const canChop = st.item && st.item.kind === 'item' && Boolean(ITEMS[st.item.itemId]?.chopTo);
        if (canChop) {
          const nearPlayer = Math.hypot(st.x - this.player.x, st.z - this.player.z) <= STATION_REACH;
          const activeBoost = nearPlayer && (this.activeChopPulse > 0 || this.activeChopHold || this.keys.has('KeyF')) ? 2.2 : 1.0;
          const sousBoost = this.sousChefAutoPrep ? 1.5 : 1.0;
          st.progress += (dt * cls.chopMult * activeBoost * sousBoost) / CHOP_BASE_DURATION;

          // Rhythmic wood thwack-thwack SFX & animated bouncing cleaver!
          st.chopSfxTimer -= dt * activeBoost;
          if (st.chopSfxTimer <= 0) {
            st.chopSfxTimer = 0.28;
            this.audio.playChop();
          }
          if (vis && vis.cleaverMesh) {
            const wave = Math.abs(Math.sin(this.time * (activeBoost > 1 ? 22 : 13)));
            vis.cleaverMesh.position.y = 1.09 + wave * 0.24;
            vis.cleaverMesh.rotation.x = -wave * 0.45;
          }
          if (st.progress >= 1.0) {
            this._finishChop(st);
          }
        } else if (vis && vis.cleaverMesh) {
          vis.cleaverMesh.position.y = 1.09;
          vis.cleaverMesh.rotation.x = 0;
        }
      }

      // Gas Cooktop Stoves
      if (st.type === 'stove') {
        stoveList.push(st);
        const vis = this.world.stationVisuals.get(st.id);
        const isCooking = st.item && st.item.kind === 'item' && Boolean(ITEMS[st.item.itemId]?.cookTo);
        const isCookedReady = st.item && st.item.kind === 'item' && st.progress >= 1 && st.item.itemId !== 'burnt';

        if (isCooking) {
          st.progress += dt / COOK_BASE_DURATION;
          st.sizzleTimer -= dt;
          if (st.sizzleTimer <= 0) {
            st.sizzleTimer = 0.75;
            this.audio.playSizzle();
            this.world.spawnParticle(
              st.x + (this._rand() - 0.5) * 0.24,
              1.48,
              st.z + (this._rand() - 0.5) * 0.24,
              (this._rand() - 0.5) * 0.25,
              1.1,
              (this._rand() - 0.5) * 0.25,
              0xf8fafc,
              0.75,
              0.55,
              1.3
            );
          }
          if (vis && vis.potMesh) {
            vis.potMesh.position.y = 1.05 + Math.abs(Math.sin(this.time * 18)) * 0.035;
          }
          if (st.progress >= 1.0) {
            st.progress = 1.0;
            st.item.itemId = ITEMS[st.item.itemId].cookTo;
            st.overcookTime = 0;
            this.audio.playDing();
            syncItemVisualMesh(st.visualMesh, st.item);
          }
        } else if (isCookedReady && !st.onFire) {
          // Overcooking countdown (slowed 2x by Fireproof Pro!)
          st.overcookTime += dt / cls.burnSlowMult;
          if (vis && vis.potMesh) {
            vis.potMesh.position.y = 1.05 + Math.abs(Math.sin(this.time * 24)) * 0.05;
          }
          if (st.overcookTime >= SMOKE_DELAY_SEC) {
            // Emit dark smoke + urgent warning beep!
            st.alarmTimer -= dt;
            if (st.alarmTimer <= 0) {
              st.alarmTimer = 0.65;
              this.audio.playAlarm(false);
              this.world.spawnParticle(
                st.x + (this._rand() - 0.5) * 0.25,
                1.5,
                st.z + (this._rand() - 0.5) * 0.25,
                (this._rand() - 0.5) * 0.3,
                1.35,
                (this._rand() - 0.5) * 0.3,
                0x334155,
                0.9,
                0.7,
                1.7
              );
            }
          }
          if (st.overcookTime >= FIRE_DELAY_SEC) {
            this.igniteStove(st.id);
          }
        } else if (st.onFire) {
          st.fireSpreadTime += dt;
          st.alarmTimer -= dt;
          if (st.alarmTimer <= 0) {
            st.alarmTimer = 0.9;
            this.audio.playAlarm(true);
            this.world.spawnParticle(
              st.x + (this._rand() - 0.5) * 0.3,
              1.95,
              st.z + (this._rand() - 0.5) * 0.3,
              (this._rand() - 0.5) * 0.35,
              1.45,
              (this._rand() - 0.5) * 0.35,
              0x1e293b,
              0.95,
              0.8,
              1.9
            );
          }
        } else if (vis && vis.potMesh) {
          vis.potMesh.position.y = 1.05;
        }
      }

      // Sink manual + Sous-Chef assisted washing
      if (st.type === 'sink' && st.dirtyPlates > 0) {
        st.washProgress += dt * 0.45; // Sous-Chef Chef Mochi helps wash dirty plates cleanly!
        if (st.washProgress >= 1.0) {
          st.washProgress = 0;
          st.dirtyPlates--;
          const stack = this.stationById.get('plate_stack');
          if (stack) stack.cleanPlates = Math.min(6, stack.cleanPlates + 1);
          this.world.spawnParticle(st.x, 1.3, st.z, 0, 0.9, 0, 0xbae6fd, 0.65, 0.5, 1.2);
        }
      }
    }

    // Fire spread to adjacent stove if burning unattended > 14s
    for (let i = 0; i < stoveList.length; i++) {
      const s = stoveList[i];
      if (s.onFire && s.fireSpreadTime >= FIRE_SPREAD_SEC) {
        s.fireSpreadTime = 0;
        const adj = stoveList[i + 1] || stoveList[i - 1];
        if (adj && !adj.onFire) {
          this.igniteStove(adj.id);
        }
      }
    }
  }

  igniteStove(stoveId = 'stove_1') {
    const st = this.stationById.get(stoveId);
    if (!st || st.type !== 'stove') return false;
    st.onFire = true;
    st.extinguishProgress = 0;
    st.fireSpreadTime = 0;
    st.item = { kind: 'item', itemId: 'burnt' };
    syncItemVisualMesh(st.visualMesh, st.item);
    this.audio.playAlarm(true);
    return true;
  }

  _updateConveyorAndSous(dt) {
    // Slide served dishes cleanly along the red motorized conveyor belt!
    for (const s of this.slidingDishes) {
      if (!s.active) continue;
      s.t += dt * 1.1;
      s.mesh.position.set(2.9 + s.t * 2.4, 1.0, 4.0);
      if (s.t >= 1.0) {
        s.active = false;
        s.mesh.visible = false;
      }
    }

    // Return dirty plates to sink after deliveries
    for (let i = this._pendingDirtyReturns.length - 1; i >= 0; i--) {
      this._pendingDirtyReturns[i] -= dt;
      if (this._pendingDirtyReturns[i] <= 0) {
        this._pendingDirtyReturns.splice(i, 1);
        const sink = this.stationById.get('sink_s');
        if (sink) sink.dirtyPlates++;
      }
    }

    // Animate friendly AI Sous-Chef buddy (Chef Mochi near sink)
    const sink = this.stationById.get('sink_s');
    const washing = Boolean(sink && sink.dirtyPlates > 0);
    if (this.sousChef.cheerTimer > 0) this.sousChef.cheerTimer = Math.max(0, this.sousChef.cheerTimer - dt);
    this.sousChef.yaw = washing ? 0 : Math.PI + Math.sin(this.time * 1.2) * 0.35;
    this.sousRig.group.position.set(this.sousChef.x, 0, this.sousChef.z);
    this.sousRig.group.rotation.y = this.sousChef.yaw;
    this.sousRig.update(dt, 0, {
      chopping: washing,
      cheering: this.sousChef.cheerTimer > 0,
    });
  }

  _updateOrders(dt) {
    const cls = this.getActiveClass();
    for (let i = this.orders.length - 1; i >= 0; i--) {
      const ord = this.orders[i];
      ord.timeLeft -= dt * cls.patienceDrainMult;
      if (ord.timeLeft <= 0) {
        this.orders.splice(i, 1);
        this.streak = 0;
        this.ui.showToast('⏰ Order expired! Streak reset to x1 TIP', 2.0);
      }
    }

    this._orderSpawnTimer -= dt;
    if (this.orders.length < 2 || (this._orderSpawnTimer <= 0 && this.orders.length < 4)) {
      this._spawnOrder();
      this._orderSpawnTimer = Math.max(9.0, 15.0 - this.shiftNumber * 0.8);
    }
  }

  // ---------------- SHIFT END & RNG CHEF CLASS GACHA WHEEL ----------------
  computeStars() {
    let stars = 0;
    for (const th of STAR_THRESHOLDS) {
      if (this.shiftCoins >= th) stars++;
    }
    return stars;
  }

  getShiftEndSummary() {
    return {
      stars: this.computeStars(),
      shiftCoins: this.shiftCoins,
      totalCoins: this.totalCoins,
      ordersServed: this.ordersServed,
      peakTipMult: this.peakTipMult,
      equippedClass: this.getActiveClass(),
      freeRolls: this.freeRolls,
      shiftNumber: this.shiftNumber,
    };
  }

  reopenShiftEndModal() {
    if (!this.shiftEnded) return;
    this.ui.openShiftEndModal(this.getShiftEndSummary());
  }

  finishShift() {
    if (this.shiftEnded) return this.getState();
    this.shiftEnded = true;
    this.cancelAutoWalk();
    this.keys.clear();
    this.scriptInput.x = 0;
    this.scriptInput.z = 0;
    this.touchInput.x = 0;
    this.touchInput.z = 0;
    this.activeChopHold = false;
    this.player.dashTimer = 0;
    this.player.speed = 0;

    const stars = this.computeStars();
    if (stars > this.bestStars) this.bestStars = stars;
    this.shiftsCompleted++;
    this._save();
    this.audio.playFanfare();

    this.ui.openShiftEndModal(this.getShiftEndSummary());
    return this.getState();
  }

  toggleLuckBoost() {
    if (this.luckBoostActive) {
      this.luckBoostActive = false;
      this._save();
      this.ui.syncGachaModal(this._getGachaUiState());
      return true;
    }
    if (this.totalCoins < LUCK_BOOST_COST) {
      this.ui.showToast(`Need $${LUCK_BOOST_COST} coins for +30% Luck Boost!`, 1.8);
      return false;
    }
    this.totalCoins -= LUCK_BOOST_COST;
    this.luckBoostActive = true;
    this.audio.playDing();
    this._save();
    this.ui.syncGachaModal(this._getGachaUiState());
    return true;
  }

  rollChefClass(instant = false) {
    if (this.gacha.spinning) return null;
    const isFree = this.freeRolls > 0;
    if (!isFree && this.totalCoins < ROLL_COST) {
      this.ui.showToast(`Need $${ROLL_COST} coins to Roll Class!`, 1.8);
      return null;
    }
    if (isFree) {
      this.freeRolls--;
    } else {
      this.totalCoins -= ROLL_COST;
    }

    const useLuck = this.luckBoostActive || this.getActiveClass().luckBonus > 0;
    let totalW = 0;
    for (const c of CHEF_CLASSES) totalW += useLuck ? c.luckWeight : c.weight;
    let roll = this._rand() * totalW;
    let chosen = CHEF_CLASSES[0];
    for (const c of CHEF_CLASSES) {
      roll -= useLuck ? c.luckWeight : c.weight;
      if (roll <= 0) {
        chosen = c;
        break;
      }
    }

    this.luckBoostActive = false; // consumed on spin
    this.gacha.resultClassId = chosen.id;

    if (instant) {
      this.gacha.spinning = false;
      this._completeGachaRoll(chosen.id);
    } else {
      this.gacha.spinning = true;
      this.gacha.timer = 0;
      this.gacha.duration = 1.65;
      this.gacha.lastTickIdx = -1;
      this.ui.startGachaSpin(chosen.id, this._getGachaUiState());
    }
    return chosen.id;
  }

  _completeGachaRoll(classId) {
    this.equippedClassId = classId;
    if (!this.unlockedClasses.includes(classId)) {
      this.unlockedClasses.push(classId);
    }
    this._save();
    this.audio.playFanfare();
    const cls = CLASS_BY_ID[classId];
    this.ui.finishGachaSpin(cls, this._getGachaUiState());
    this.ui.showToast(`🎉 Equipped ${cls.name} (${cls.perk})!`, 2.8);
    this._syncHud();
  }

  _getGachaUiState() {
    return {
      totalCoins: this.totalCoins,
      freeRolls: this.freeRolls,
      rollCost: ROLL_COST,
      luckBoostCost: LUCK_BOOST_COST,
      luckBoostActive: this.luckBoostActive,
      equippedClass: this.getActiveClass(),
      spinning: this.gacha.spinning,
      classes: CHEF_CLASSES,
    };
  }

  // ---------------- HUD SYNC ----------------
  _getReadyIngredientSet() {
    const ready = new Set();
    const addFromSpec = (spec) => {
      if (!spec) return;
      if (spec.kind === 'item') ready.add(spec.itemId);
      if (spec.kind === 'plate') {
        for (const id of spec.ingredients || []) ready.add(id);
      }
    };
    addFromSpec(this.player.held);
    for (const st of this.stations) {
      if (st.item && (st.type !== 'stove' || st.progress >= 1)) {
        addFromSpec(st.item);
      }
    }
    return ready;
  }

  _syncHud() {
    const anyFire = this.stations.some((s) => s.onFire);
    const readySet = this._getReadyIngredientSet();

    // Build floating world progress rings for chopping boards, stoves & burning pots
    const worldBars = [];
    for (const st of this.stations) {
      if (st.onFire) {
        worldBars.push({
          id: st.id,
          x: st.x,
          y: 2.3,
          z: st.z,
          frac: Math.max(0.08, 1 - st.extinguishProgress),
          color: '#ef4444',
          label: '🔥 FIRE!',
        });
      } else if (st.type === 'board' && st.item && st.item.kind === 'item' && ITEMS[st.item.itemId]?.chopTo) {
        worldBars.push({
          id: st.id,
          x: st.x,
          y: 1.9,
          z: st.z,
          frac: Math.min(1, st.progress),
          color: '#22c55e',
          label: '🔪 CHOP',
        });
      } else if (st.type === 'stove' && st.item && st.item.kind === 'item' && st.item.itemId !== 'burnt') {
        if (st.progress < 1) {
          worldBars.push({
            id: st.id,
            x: st.x,
            y: 1.95,
            z: st.z,
            frac: Math.min(1, st.progress),
            color: '#facc15',
            label: '🍳 COOK',
          });
        } else {
          const warnFrac = Math.min(1, st.overcookTime / FIRE_DELAY_SEC);
          worldBars.push({
            id: st.id,
            x: st.x,
            y: 1.95,
            z: st.z,
            frac: warnFrac > 0.45 ? 1 - warnFrac : 1,
            color: warnFrac > 0.45 ? '#ef4444' : '#4ade80',
            label: warnFrac > 0.45 ? '⚠️ HOT!' : '✓ READY',
          });
        }
      }
    }

    this.ui.syncHud({
      totalCoins: this.totalCoins,
      shiftCoins: this.shiftCoins,
      tipMult: this.getTipMultiplier(),
      streak: this.streak,
      shiftTimer: this.shiftTimer,
      shiftDuration: SHIFT_DURATION_SEC,
      orders: this.orders,
      readySet,
      anyFire,
      equippedClass: this.getActiveClass(),
      actionLabel: this.player.actionLabel,
      dashCooldownFrac: Math.min(1, this.player.dashCooldown / 0.95),
      held: this.player.held,
      worldBars,
      camera: this.camera,
      width: window.innerWidth,
      height: window.innerHeight,
      audio: this.audio.getState(),
      sousChefAutoPrep: this.sousChefAutoPrep,
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  getState() {
    return {
      totalCoins: this.totalCoins,
      shiftCoins: this.shiftCoins,
      ordersServed: this.ordersServed,
      streak: this.streak,
      tipMult: this.getTipMultiplier(),
      shiftTimer: Number(this.shiftTimer.toFixed(2)),
      shiftEnded: this.shiftEnded,
      stars: this.computeStars(),
      bestStars: this.bestStars,
      shiftsCompleted: this.shiftsCompleted,
      equippedClassId: this.equippedClassId,
      freeRolls: this.freeRolls,
      luckBoostActive: this.luckBoostActive,
      playerPos: { x: Number(this.player.x.toFixed(3)), z: Number(this.player.z.toFixed(3)) },
      playerYaw: Number(this.player.yaw.toFixed(3)),
      playerSpeed: Number(this.player.speed.toFixed(3)),
      held: this.player.held ? JSON.parse(JSON.stringify(this.player.held)) : null,
      nearestStation: this.player.nearestStation ? this.player.nearestStation.id : null,
      actionLabel: this.player.actionLabel,
      hasWalkTarget: Boolean(this.walkTarget),
      activeFires: this.stations.filter((s) => s.onFire).map((s) => s.id),
      orderCount: this.orders.length,
      orders: this.orders.map((o) => ({ recipeId: o.recipeId, timeLeft: Number(o.timeLeft.toFixed(1)) })),
      cameraYaw: this.camYaw,
      cameraRotZ: Number(this.camera.rotation.z.toFixed(6)),
      drawCalls: this.renderer.info.render.calls,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  }
}
