import * as THREE from '../vendor/three.module.min.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finalizeTex(canvas, repeat = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function seeded(i) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Beige commercial kitchen ceramic tile floor (4x4 warm cream-beige tiles w/ subtle grout & Roblox gleam)
 */
function buildKitchenTileTex() {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  // Grout lines
  ctx.fillStyle = '#b9ad99';
  ctx.fillRect(0, 0, size, size);

  const cells = 4;
  const step = size / cells;
  const tones = ['#efe5d1', '#ece0ca', '#f3ead8', '#e8dcc4'];

  for (let r = 0; r < cells; r++) {
    for (let col = 0; col < cells; col++) {
      const x = col * step;
      const y = r * step;
      const tone = tones[(r * 3 + col) % tones.length];
      ctx.fillStyle = tone;
      ctx.fillRect(x + 2, y + 2, step - 4, step - 4);

      // Subtle glossy ceramic bevel highlight
      ctx.fillStyle = 'rgba(255, 252, 245, 0.38)';
      ctx.fillRect(x + 3, y + 3, step - 6, 4);
      ctx.fillRect(x + 3, y + 3, 4, step - 6);

      ctx.fillStyle = 'rgba(130, 114, 88, 0.14)';
      ctx.fillRect(x + 3, y + step - 6, step - 6, 3);
    }
  }

  // Subtle tile speckles
  for (let i = 0; i < 240; i++) {
    const px = seeded(i * 3 + 1) * size;
    const py = seeded(i * 3 + 2) * size;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(140,122,95,0.10)';
    ctx.fillRect(px, py, 2, 2);
  }

  return finalizeTex(c, true);
}

/**
 * Exterior restaurant dining hardwood floor (warm amber planks)
 */
function buildDiningFloorTex() {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#c49664';
  ctx.fillRect(0, 0, size, size);

  const rows = 8;
  const rowH = size / rows;
  const tones = ['#cf9f6c', '#c2905c', '#d6a976', '#b88653'];

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const split = ((r * 73 + 52) % 180) + 38;
    ctx.fillStyle = tones[r % tones.length];
    ctx.fillRect(0, y, split, rowH - 2);
    ctx.fillStyle = tones[(r + 2) % tones.length];
    ctx.fillRect(split, y, size - split, rowH - 2);

    ctx.strokeStyle = 'rgba(102, 62, 28, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + rowH * 0.45);
    ctx.bezierCurveTo(size * 0.3, y + rowH * 0.55, size * 0.7, y + rowH * 0.35, size, y + rowH * 0.48);
    ctx.stroke();

    ctx.fillStyle = 'rgba(84, 52, 24, 0.36)';
    ctx.fillRect(0, y + rowH - 2, size, 2);
    ctx.fillRect(split - 1, y, 2, rowH);
  }

  return finalizeTex(c, true);
}

/**
 * Golden honey-oak butcher-block counter top texture
 */
function buildOakButcherBlockTex() {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#d99b4e';
  ctx.fillRect(0, 0, size, size);

  const strips = 10;
  const stripH = size / strips;
  const tones = ['#e2a858', '#d59647', '#eab366', '#cc8c3d', '#dfa252'];

  for (let i = 0; i < strips; i++) {
    const y = i * stripH;
    const split = ((i * 97 + 40) % 176) + 40;
    ctx.fillStyle = tones[i % tones.length];
    ctx.fillRect(0, y, split, stripH - 1.5);
    ctx.fillStyle = tones[(i + 2) % tones.length];
    ctx.fillRect(split, y, size - split, stripH - 1.5);

    ctx.fillStyle = 'rgba(255, 242, 210, 0.16)';
    ctx.fillRect(0, y + 1, size, 2.5);
    ctx.fillStyle = 'rgba(120, 72, 24, 0.25)';
    ctx.fillRect(0, y + stripH - 1.5, size, 1.5);
    ctx.fillRect(split, y, 1.5, stripH);
  }

  return finalizeTex(c, true);
}

/**
 * Brushed commercial stainless steel texture (bright, crisp even with low metalness!)
 */
function buildStainlessTex() {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#d8e0e8');
  grad.addColorStop(0.5, '#e8eef5');
  grad.addColorStop(1, '#c6d0db');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 2) {
    const a = 0.04 + seeded(y * 7) * 0.08;
    ctx.fillStyle = y % 4 === 0 ? `rgba(255,255,255,${a})` : `rgba(82,96,112,${a})`;
    ctx.fillRect(0, y, size, 1.5);
  }

  ctx.strokeStyle = 'rgba(92, 108, 126, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  return finalizeTex(c, true);
}

/**
 * Red Motorized Serving Conveyor Belt with crisp moving white/gold chevrons
 */
function buildConveyorTex() {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#c82626';
  ctx.fillRect(0, 0, size, size);

  // Dark rubber side rails
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(0, 0, size, 18);
  ctx.fillRect(0, size - 18, size, 18);

  // Repeating bright chevrons pointing +X (out to dining room)
  for (let x = -64; x < size + 64; x += 64) {
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 12, 46);
    ctx.lineTo(x + 44, size * 0.5);
    ctx.lineTo(x + 12, size - 46);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(x, 20, 4, size - 40);
  }

  return finalizeTex(c, true);
}

/**
 * Bright Glowing Neon "SUSHI" Exterior Wall Sign!
 */
function buildNeonSushiTex() {
  const w = 512;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  // Deep navy-plum wood backing panel
  ctx.fillStyle = '#1f1636';
  ctx.fillRect(0, 0, w, h);

  // Outer glowing cyan neon tube border
  ctx.save();
  ctx.strokeStyle = '#22d3ee';
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 18;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(18, 18, w - 36, h - 36, 28);
  ctx.stroke();
  ctx.strokeStyle = '#e0f2fe';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();

  // Inner subtle pink accent bar
  ctx.save();
  ctx.strokeStyle = '#f472b6';
  ctx.shadowColor = '#ec4899';
  ctx.shadowBlur = 14;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(56, 202);
  ctx.lineTo(w - 56, 202);
  ctx.stroke();
  ctx.restore();

  // Huge Glowing Hot-Pink Neon "SUSHI" Letters!
  ctx.save();
  ctx.font = '900 116px "Trebuchet MS", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff2e93';
  ctx.shadowBlur = 28;
  ctx.fillStyle = '#ff4da6';
  ctx.fillText('SUSHI', w * 0.5, 118);

  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffe4f2';
  ctx.fillText('SUSHI', w * 0.5, 118);
  ctx.restore();

  // Subtitle "HOT WOK BAR"
  ctx.fillStyle = '#67e8f9';
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HOT WOK KITCHEN', w * 0.5, 222);

  return finalizeTex(c, false);
}

/**
 * Secondary warm kitchen banner sign ("COOKING CHAOS")
 */
function buildBannerSignTex() {
  const w = 512;
  const h = 128;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  ctx.fillStyle = '#fef08a';
  ctx.font = '900 48px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('COOKING CHAOS', w * 0.5, 66);

  return finalizeTex(c, false);
}

export function createKitchenTextures() {
  return {
    kitchenTile: buildKitchenTileTex(),
    diningFloor: buildDiningFloorTex(),
    oakBlock: buildOakButcherBlockTex(),
    stainless: buildStainlessTex(),
    conveyor: buildConveyorTex(),
    neonSushi: buildNeonSushiTex(),
    bannerSign: buildBannerSignTex(),
  };
}
