/**
 * Authentic Roblox R6 Chef, Sous-Chef & Seated Exterior Diner Avatars for Cooking Chaos.
 * - Low draw-call design: 6 meshes for active R6 avatars, 2 meshes for seated diners.
 * - Classic white chef double-breasted tunic, apron, neckerchief & tall pleated Toque hat!
 * - Strict PBR bounds: metalness <= 0.22, roughness >= 0.28, zero pitch black.
 */

import * as THREE from '../vendor/three.module.min.js';

export const CHEF_PRESETS = {
  chef_player: {
    id: 'chef_player',
    name: 'Head Chef',
    skin: 0xf4cca6,
    skinCss: '#f4cca6',
    torso: 0xf8fafc,
    torsoAccent: 0xe2e8f0,
    neckerchief: 0xef4444,
    apron: 0xf1f5f9,
    torsoStyle: 'chef',
    sleeve: 0xf8fafc,
    pants: 0x334155,
    shoes: 0x1e293b,
    hat: 'toque',
    hatColor: '#ffffff',
    hatBand: '#e2e8f0',
    hatHighlight: '#f8fafc',
    hair: 'tufts',
    hairColor: '#4a3222',
    faceStyle: 'happy_chef',
  },
  sous_chef: {
    id: 'sous_chef',
    name: 'Chef Mochi',
    skin: 0xf2c8a0,
    skinCss: '#f2c8a0',
    torso: 0xf8fafc,
    torsoAccent: 0xdbeafe,
    neckerchief: 0x14b8a6,
    apron: 0xe0f2fe,
    torsoStyle: 'chef',
    sleeve: 0xf8fafc,
    pants: 0x3b4a5e,
    shoes: 0x1e293b,
    hat: 'toque',
    hatColor: '#ffffff',
    hatBand: '#14b8a6',
    hatHighlight: '#f0fdfa',
    hair: 'bob',
    hairColor: '#2d2420',
    faceStyle: 'friendly_grin',
  },
  diner_0: {
    id: 'diner_0',
    name: 'Mia',
    skin: 0xf5cfb0,
    skinCss: '#f5cfb0',
    torso: 0xec4899,
    torsoAccent: 0xf9a8d4,
    sleeve: 0xec4899,
    pants: 0x3b82f6,
    shoes: 0x1e293b,
    hat: 'none',
    hatColor: '#ec4899',
    hatBand: '#ffffff',
    hatHighlight: '#fbcfe8',
    hair: 'bob',
    hairColor: '#5c3a21',
    faceStyle: 'friendly_grin',
  },
  diner_1: {
    id: 'diner_1',
    name: 'Kai',
    skin: 0xe5b385,
    skinCss: '#e5b385',
    torso: 0x0ea5e9,
    torsoAccent: 0x38bdf8,
    sleeve: 0x0ea5e9,
    pants: 0x334155,
    shoes: 0x1e293b,
    hat: 'cap',
    hatColor: '#0284c7',
    hatBand: '#f8fafc',
    hatHighlight: '#7dd3fc',
    hair: 'none',
    hairColor: '#272320',
    faceStyle: 'classic_smile',
  },
  diner_2: {
    id: 'diner_2',
    name: 'Zoe',
    skin: 0xd9a273,
    skinCss: '#d9a273',
    torso: 0xa855f7,
    torsoAccent: 0xd8b4fe,
    sleeve: 0xa855f7,
    pants: 0x475569,
    shoes: 0x1e293b,
    hat: 'none',
    hatColor: '#a855f7',
    hatBand: '#f3e8ff',
    hatHighlight: '#e9d5ff',
    hair: 'spiky',
    hairColor: '#eab308',
    faceStyle: 'friendly_grin',
  },
  diner_3: {
    id: 'diner_3',
    name: 'Sam',
    skin: 0xf0c294,
    skinCss: '#f0c294',
    torso: 0x10b981,
    torsoAccent: 0x6ee7b7,
    sleeve: 0x10b981,
    pants: 0x3f4756,
    shoes: 0x1e293b,
    hat: 'beanie',
    hatColor: '#f59e0b',
    hatBand: '#b45309',
    hatHighlight: '#fde68a',
    hair: 'none',
    hairColor: '#3f2e21',
    faceStyle: 'classic_smile',
  },
};

let _sharedBodyMat = null;
function getSharedBodyMat() {
  if (!_sharedBodyMat) {
    _sharedBodyMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.58,
      metalness: 0.06,
    });
    _sharedBodyMat.userData.shared = true;
  }
  return _sharedBodyMat;
}

const _presetCache = new Map();

function createColorBatcher() {
  const chunks = [];
  const tmpColor = new THREE.Color();
  const tmpMat = new THREE.Matrix4();
  const tmpQuat = new THREE.Quaternion();
  const tmpEuler = new THREE.Euler();
  const tmpPos = new THREE.Vector3();
  const tmpScale = new THREE.Vector3();

  function addGeo(rawGeo, hexColor, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const geo = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
    rawGeo.dispose();
    tmpEuler.set(rx, ry, rz);
    tmpQuat.setFromEuler(tmpEuler);
    tmpPos.set(x, y, z);
    tmpScale.set(1, 1, 1);
    tmpMat.compose(tmpPos, tmpQuat, tmpScale);
    geo.applyMatrix4(tmpMat);
    if (!geo.attributes.normal) geo.computeVertexNormals();

    tmpColor.setHex(hexColor);
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    chunks.push({
      pos: geo.attributes.position.array,
      norm: geo.attributes.normal.array,
      col: colors,
      count,
    });
    geo.dispose();
  }

  return {
    box(w, h, d, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
      addGeo(new THREE.BoxGeometry(w, h, d), hex, x, y, z, rx, ry, rz);
    },
    build() {
      let total = 0;
      for (const c of chunks) total += c.count;
      const pos = new Float32Array(total * 3);
      const norm = new Float32Array(total * 3);
      const col = new Float32Array(total * 3);
      let off = 0;
      for (const c of chunks) {
        pos.set(c.pos, off * 3);
        norm.set(c.norm, off * 3);
        col.set(c.col, off * 3);
        off += c.count;
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
      out.setAttribute('color', new THREE.BufferAttribute(col, 3));
      out.computeBoundingSphere();
      return out;
    },
  };
}

function createUvBatcher() {
  const chunks = [];
  const tmpMat = new THREE.Matrix4();
  const tmpQuat = new THREE.Quaternion();
  const tmpEuler = new THREE.Euler();
  const tmpPos = new THREE.Vector3();
  const tmpScale = new THREE.Vector3();

  function addRaw(rawGeo, uvMapper, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const geo = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
    rawGeo.dispose();
    tmpEuler.set(rx, ry, rz);
    tmpQuat.setFromEuler(tmpEuler);
    tmpPos.set(x, y, z);
    tmpScale.set(1, 1, 1);
    tmpMat.compose(tmpPos, tmpQuat, tmpScale);
    geo.applyMatrix4(tmpMat);
    if (!geo.attributes.normal) geo.computeVertexNormals();

    const count = geo.attributes.position.count;
    const uvAttr = geo.attributes.uv;
    const uvs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const u = uvAttr ? uvAttr.getX(i) : 0.5;
      const v = uvAttr ? uvAttr.getY(i) : 0.5;
      const mapped = uvMapper(u, v);
      uvs[i * 2] = mapped[0];
      uvs[i * 2 + 1] = mapped[1];
    }
    chunks.push({
      pos: geo.attributes.position.array,
      norm: geo.attributes.normal.array,
      uv: uvs,
      count,
    });
    geo.dispose();
  }

  function swatchMapper(idx) {
    const su = (idx + 0.5) / 8;
    return () => [su, 0.125];
  }

  return {
    addFaceCylinder(rt, rb, h, segs, x, y, z) {
      const g = new THREE.CylinderGeometry(rt, rb, h, segs, 1, true, Math.PI, Math.PI * 2);
      addRaw(g, (u, v) => [u, 0.27 + v * 0.71], x, y, z);
    },
    box(w, h, d, swatchIdx, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
      addRaw(new THREE.BoxGeometry(w, h, d), swatchMapper(swatchIdx), x, y, z, rx, ry, rz);
    },
    cyl(rt, rb, h, segs, swatchIdx, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
      addRaw(new THREE.CylinderGeometry(rt, rb, h, segs), swatchMapper(swatchIdx), x, y, z, rx, ry, rz);
    },
    sphere(r, ws, hs, swatchIdx, x = 0, y = 0, z = 0) {
      addRaw(new THREE.SphereGeometry(r, ws, hs), swatchMapper(swatchIdx), x, y, z);
    },
    build() {
      let total = 0;
      for (const c of chunks) total += c.count;
      const pos = new Float32Array(total * 3);
      const norm = new Float32Array(total * 3);
      const uv = new Float32Array(total * 2);
      let off = 0;
      for (const c of chunks) {
        pos.set(c.pos, off * 3);
        norm.set(c.norm, off * 3);
        uv.set(c.uv, off * 2);
        off += c.count;
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
      out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      out.computeBoundingSphere();
      return out;
    },
  };
}

function buildTorsoGeo(p) {
  const b = createColorBatcher();
  b.box(0.78, 0.78, 0.40, p.torso, 0, 0, 0);

  if (p.torsoStyle === 'chef') {
    // Crisp chef neckerchief collar
    b.box(0.46, 0.11, 0.43, p.neckerchief || 0xef4444, 0, 0.34, 0.01);
    b.box(0.16, 0.16, 0.05, p.neckerchief || 0xef4444, 0, 0.24, 0.21, 0, 0, Math.PI * 0.25);
    // Double-breasted chef buttons (2 rows of 3)
    for (let r = 0; r < 3; r++) {
      const y = 0.18 - r * 0.14;
      b.box(0.055, 0.055, 0.03, 0x334155, -0.14, y, 0.205);
      b.box(0.055, 0.055, 0.03, 0x334155, 0.14, y, 0.205);
    }
    // Crisp waist apron wrap + front pocket
    b.box(0.81, 0.08, 0.43, p.neckerchief || 0xef4444, 0, -0.14, 0);
    b.box(0.80, 0.24, 0.42, p.apron || 0xf1f5f9, 0, -0.28, 0.005);
    b.box(0.36, 0.14, 0.035, p.torsoAccent || 0xdbeafe, 0, -0.28, 0.22);
  } else {
    // Casual diner jacket trim
    b.box(0.79, 0.08, 0.41, p.torsoAccent, 0, -0.35, 0);
    b.box(0.34, 0.07, 0.42, 0xf8fafc, 0, 0.36, 0);
  }
  return b.build();
}

function buildArmGeo(p) {
  const b = createColorBatcher();
  b.box(0.38, 0.54, 0.38, p.sleeve, 0, -0.23, 0);
  if (p.torsoStyle === 'chef') {
    // Turned-up chef sleeve cuff
    b.box(0.40, 0.08, 0.40, p.torsoAccent || 0xe2e8f0, 0, -0.46, 0);
  }
  b.box(0.37, 0.18, 0.37, p.skin, 0, -0.59, 0);
  return b.build();
}

function buildLegGeo(p) {
  const b = createColorBatcher();
  b.box(0.38, 0.55, 0.38, p.pants, 0, -0.275, 0);
  b.box(0.385, 0.17, 0.41, p.shoes, 0, -0.635, 0.015);
  b.box(0.39, 0.04, 0.42, 0xe2e8f0, 0, -0.70, 0.015);
  return b.build();
}

function buildHeadTexture(p) {
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = p.skinCss;
  ctx.fillRect(0, 0, w, 192);

  if (p.hair && p.hair !== 'none') {
    ctx.fillStyle = p.hairColor;
    ctx.fillRect(0, 0, 172, 165);
    ctx.fillRect(340, 0, 172, 165);
    ctx.fillRect(172, 0, 168, 36);
    ctx.fillRect(166, 28, 18, 56);
    ctx.fillRect(328, 28, 18, 56);
  }

  const cx = 256;
  const eyeY = 86;
  const eyeOff = 28;

  // Classic Roblox eyes with crisp specular glint
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.ellipse(cx - eyeOff, eyeY, 9.5, 13.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + eyeOff, eyeY, 9.5, 13.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - eyeOff - 2.6, eyeY - 4.4, 3.4, 0, Math.PI * 2);
  ctx.arc(cx + eyeOff - 2.6, eyeY - 4.4, 3.4, 0, Math.PI * 2);
  ctx.fill();

  // Rosy cheerful cheeks for chef / diners
  ctx.fillStyle = 'rgba(244, 114, 182, 0.28)';
  ctx.beginPath();
  ctx.ellipse(cx - eyeOff - 16, eyeY + 20, 11, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + eyeOff + 16, eyeY + 20, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Friendly eyebrows
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - eyeOff - 11, eyeY - 23);
  ctx.quadraticCurveTo(cx - eyeOff, eyeY - 28, cx - eyeOff + 11, eyeY - 23);
  ctx.moveTo(cx + eyeOff - 11, eyeY - 23);
  ctx.quadraticCurveTo(cx + eyeOff, eyeY - 28, cx + eyeOff + 11, eyeY - 23);
  ctx.stroke();

  // Big Roblox smile
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 5;
  if (p.faceStyle === 'happy_chef' || p.faceStyle === 'friendly_grin') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, 122, 22, 0.08 * Math.PI, 0.92 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, 118, 22, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
  }

  // Bottom 25% palette swatches
  const swatches = [
    p.skinCss,        // 0: skin
    p.hatColor,       // 1: hat primary
    p.hatBand,        // 2: hat band
    p.hairColor,      // 3: hair
    '#334155',        // 4: dark accent
    '#ef4444',        // 5: red accent
    p.hatHighlight,   // 6: hat highlight
    '#f8fafc',        // 7: crisp white
  ];
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = swatches[i];
    ctx.fillRect(i * 64, 192, 64, 64);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildHeadGeo(p) {
  const b = createUvBatcher();
  b.cyl(0.11, 0.12, 0.06, 10, 0, 0, 0.03, 0);
  b.cyl(0.265, 0.215, 0.065, 18, 0, 0, 0.0825, 0);
  b.addFaceCylinder(0.265, 0.265, 0.36, 18, 0, 0.295, 0);
  const topSwatch = p.hair && p.hair !== 'none' ? 3 : 0;
  b.cyl(0.215, 0.265, 0.065, 18, topSwatch, 0, 0.5075, 0);
  b.cyl(0.175, 0.215, 0.025, 18, topSwatch, 0, 0.55, 0);

  if (p.hair === 'bob') {
    b.box(0.57, 0.14, 0.55, 3, 0, 0.51, -0.01);
    b.box(0.11, 0.40, 0.40, 3, -0.26, 0.28, -0.05);
    b.box(0.11, 0.40, 0.40, 3, 0.26, 0.28, -0.05);
    b.box(0.56, 0.42, 0.14, 3, 0, 0.28, -0.22);
  } else if (p.hair === 'spiky') {
    b.box(0.56, 0.15, 0.56, 3, 0, 0.53, -0.01);
    b.box(0.18, 0.18, 0.18, 3, -0.14, 0.63, 0.05, 0.2, 0, 0.22);
    b.box(0.20, 0.20, 0.20, 3, 0.04, 0.65, 0.02, -0.15, 0, -0.18);
    b.box(0.16, 0.16, 0.16, 3, 0.16, 0.61, -0.05, -0.2, 0, -0.28);
  } else if (p.hair === 'tufts') {
    b.box(0.54, 0.09, 0.50, 3, 0, 0.47, -0.02);
    b.box(0.52, 0.18, 0.12, 3, 0, 0.34, -0.22);
  }

  // Tall Pleated White Roblox Chef Toque Hat!
  if (p.hat === 'toque') {
    // Crisp headband cuff
    b.cyl(0.285, 0.275, 0.18, 16, 2, 0, 0.57, 0);
    // Tall puffy pleated chef crown (4 overlapping clouds + center dome)
    b.cyl(0.32, 0.285, 0.22, 16, 1, 0, 0.74, 0);
    b.sphere(0.22, 10, 8, 1, 0, 0.90, 0);
    b.sphere(0.17, 8, 7, 6, -0.16, 0.85, 0.10);
    b.sphere(0.17, 8, 7, 6, 0.16, 0.85, 0.10);
    b.sphere(0.17, 8, 7, 6, -0.14, 0.85, -0.13);
    b.sphere(0.17, 8, 7, 6, 0.14, 0.85, -0.13);
  } else if (p.hat === 'cap') {
    b.cyl(0.275, 0.285, 0.15, 16, 1, 0, 0.54, 0);
    b.cyl(0.21, 0.275, 0.06, 16, 1, 0, 0.635, 0);
    b.box(0.42, 0.038, 0.24, 2, 0, 0.495, 0.28, 0.08, 0, 0);
  } else if (p.hat === 'beanie') {
    b.cyl(0.295, 0.295, 0.11, 16, 2, 0, 0.51, -0.01);
    b.cyl(0.24, 0.285, 0.15, 16, 1, 0, 0.62, -0.02);
  }

  return b.build();
}

function getPresetAssets(presetId) {
  const key = CHEF_PRESETS[presetId] ? presetId : 'chef_player';
  if (_presetCache.has(key)) return _presetCache.get(key);

  const p = CHEF_PRESETS[key];
  const headTex = buildHeadTexture(p);
  const headMat = new THREE.MeshStandardMaterial({
    map: headTex,
    roughness: 0.52,
    metalness: 0.06,
  });
  headMat.userData.shared = true;

  const assets = {
    preset: p,
    torsoGeo: buildTorsoGeo(p),
    armGeo: buildArmGeo(p),
    legGeo: buildLegGeo(p),
    headGeo: buildHeadGeo(p),
    headMat,
  };
  _presetCache.set(key, assets);
  return assets;
}

/**
 * Full 6-mesh animated Roblox R6 Chef avatar with overhead carry socket & extinguisher aim socket.
 */
export function createChefAvatar(presetId = 'chef_player') {
  const assets = getPresetAssets(presetId);
  const bodyMat = getSharedBodyMat();

  const group = new THREE.Group();
  group.name = `r6_${assets.preset.id}`;

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.20, 0.72, 0);
  const leftLegMesh = new THREE.Mesh(assets.legGeo, bodyMat);
  leftLegMesh.castShadow = true;
  leftLegPivot.add(leftLegMesh);
  group.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.20, 0.72, 0);
  const rightLegMesh = new THREE.Mesh(assets.legGeo, bodyMat);
  rightLegMesh.castShadow = true;
  rightLegPivot.add(rightLegMesh);
  group.add(rightLegPivot);

  const torso = new THREE.Mesh(assets.torsoGeo, bodyMat);
  torso.position.set(0, 1.11, 0);
  torso.castShadow = true;
  group.add(torso);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.59, 1.46, 0);
  const leftArmMesh = new THREE.Mesh(assets.armGeo, bodyMat);
  leftArmMesh.castShadow = true;
  leftArmPivot.add(leftArmMesh);
  group.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.59, 1.46, 0);
  const rightArmMesh = new THREE.Mesh(assets.armGeo, bodyMat);
  rightArmMesh.castShadow = true;
  rightArmPivot.add(rightArmMesh);
  group.add(rightArmPivot);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.50, 0);
  const headMesh = new THREE.Mesh(assets.headGeo, assets.headMat);
  headMesh.castShadow = true;
  headPivot.add(headMesh);
  group.add(headPivot);

  // Carry socket clearly visible in front/overhead of chef!
  const carrySocket = new THREE.Group();
  carrySocket.position.set(0, 1.42, 0.68);
  group.add(carrySocket);

  const rig = {
    group,
    torso,
    headPivot,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    carrySocket,
    walkPhase: 0,
    bobPhase: 0,
    update(dt, speed, opts = {}) {
      const carrying = Boolean(opts.carrying);
      const holdingExtinguisher = Boolean(opts.holdingExtinguisher);
      const chopping = Boolean(opts.chopping);
      const dashing = Boolean(opts.dashing);
      const cheering = Boolean(opts.cheering);

      const moveFactor = Math.min(1, speed / 5.5);
      if (moveFactor > 0.05) {
        this.walkPhase += dt * (dashing ? 18 : 11.5) * Math.max(0.45, moveFactor);
      } else {
        this.walkPhase *= Math.max(0, 1 - dt * 10);
      }
      this.bobPhase += dt * 3.2;

      const legSwing = Math.sin(this.walkPhase) * 0.85 * moveFactor;
      this.leftLegPivot.rotation.x = legSwing;
      this.rightLegPivot.rotation.x = -legSwing;

      // Slight energetic forward lean when dashing
      this.torso.rotation.x = dashing ? 0.16 : moveFactor * 0.05;
      this.torso.position.y = 1.11 + Math.abs(Math.sin(this.walkPhase)) * 0.05 * moveFactor;
      this.headPivot.position.y = 1.50 + Math.abs(Math.sin(this.walkPhase)) * 0.05 * moveFactor;
      this.headPivot.rotation.z = Math.sin(this.bobPhase) * 0.03;

      if (holdingExtinguisher) {
        // Aim forward with two hands!
        this.leftArmPivot.rotation.x = -1.32;
        this.rightArmPivot.rotation.x = -1.32;
        this.leftArmPivot.rotation.z = 0.18;
        this.rightArmPivot.rotation.z = -0.18;
        this.carrySocket.position.set(0, 1.18, 0.72);
      } else if (carrying) {
        // Classic raised overhead Roblox carry pose — sits proudly above the Chef Toque so face stays 100% clear!
        this.leftArmPivot.rotation.x = -2.92;
        this.rightArmPivot.rotation.x = -2.92;
        this.leftArmPivot.rotation.z = 0.08;
        this.rightArmPivot.rotation.z = -0.08;
        this.carrySocket.position.set(0, 2.56, 0.06);
      } else if (chopping) {
        // Energetic rhythmic chopping motion!
        const chopWave = Math.sin(this.bobPhase * 6.5);
        this.rightArmPivot.rotation.x = -1.15 + chopWave * 0.55;
        this.leftArmPivot.rotation.x = -0.95;
        this.leftArmPivot.rotation.z = 0.15;
        this.rightArmPivot.rotation.z = -0.12;
      } else if (cheering) {
        this.leftArmPivot.rotation.x = -2.7 + Math.sin(this.bobPhase * 4) * 0.25;
        this.rightArmPivot.rotation.x = -2.7 - Math.sin(this.bobPhase * 4) * 0.25;
        this.leftArmPivot.rotation.z = -0.2;
        this.rightArmPivot.rotation.z = 0.2;
      } else {
        this.leftArmPivot.rotation.x = -legSwing * 0.85;
        this.rightArmPivot.rotation.x = legSwing * 0.85;
        this.leftArmPivot.rotation.z = 0.06;
        this.rightArmPivot.rotation.z = -0.06;
      }
    },
  };

  return rig;
}

/**
 * Low-draw-call (2 meshes!) Seated Blocky R6 Exterior Diner for the Purple Booths!
 */
export function createSeatedDiner(presetId = 'diner_0') {
  const assets = getPresetAssets(presetId);
  const p = assets.preset;
  const bodyMat = getSharedBodyMat();

  const b = createColorBatcher();
  // Torso seated at y=0.95
  b.box(0.76, 0.76, 0.38, p.torso, 0, 0.96, 0);
  b.box(0.77, 0.08, 0.39, p.torsoAccent, 0, 0.62, 0);
  // Bent seated legs pointing forward (+Z)
  b.box(0.35, 0.32, 0.64, p.pants, -0.19, 0.52, 0.24);
  b.box(0.35, 0.32, 0.64, p.pants, 0.19, 0.52, 0.24);
  b.box(0.34, 0.42, 0.32, p.shoes, -0.19, 0.22, 0.46);
  b.box(0.34, 0.42, 0.32, p.shoes, 0.19, 0.22, 0.46);
  // Arms resting forward toward dining table
  b.box(0.34, 0.32, 0.62, p.sleeve, -0.55, 1.02, 0.20, 0.15, 0, 0);
  b.box(0.34, 0.32, 0.62, p.sleeve, 0.55, 1.02, 0.20, 0.15, 0, 0);
  b.box(0.32, 0.22, 0.20, p.skin, -0.55, 0.98, 0.52);
  b.box(0.32, 0.22, 0.20, p.skin, 0.55, 0.98, 0.52);

  const group = new THREE.Group();
  group.name = `diner_${p.id}`;

  const bodyMesh = new THREE.Mesh(b.build(), bodyMat);
  group.add(bodyMesh);

  const headMesh = new THREE.Mesh(assets.headGeo, assets.headMat);
  headMesh.position.set(0, 1.34, 0);
  group.add(headMesh);

  return { group, headMesh };
}
