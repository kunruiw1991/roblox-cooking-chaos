/**
 * Entry point, Keyboard/iPad Input Wiring & window.__ROBLOX_COOKING__ Test API
 * for Cooking Chaos (Hot Wok Studios).
 */

import { CookingUI } from './ui.js';
import { CookingChaosGame } from './game.js';

const canvas = document.getElementById('game-canvas');
let game = null;

const ui = new CookingUI({
  onPrimaryAction: () => game && game.triggerPrimaryAction(),
  onDash: () => game && game.triggerDash(),
  onOpenMenu: () => {
    if (!game) return;
    ui.openMenuModal(game.audio.getState(), game.sousChefAutoPrep);
  },
  onOpenGacha: () => {
    if (!game) return;
    ui.openGachaModal(game._getGachaUiState());
  },
  onToggleAllAudio: () => {
    if (!game) return;
    game.audio.unlock();
    const next = !(game.audio.sfxOn || game.audio.musicOn);
    game.audio.setSfxOn(next);
    game.audio.setMusicOn(next);
    game._save();
  },
  onToggleMusic: () => {
    if (!game) return;
    game.audio.unlock();
    game.audio.setMusicOn(!game.audio.musicOn);
    ui.syncMenuModal(game.audio.getState(), game.sousChefAutoPrep);
    game._save();
  },
  onToggleSfx: () => {
    if (!game) return;
    game.audio.unlock();
    game.audio.setSfxOn(!game.audio.sfxOn);
    ui.syncMenuModal(game.audio.getState(), game.sousChefAutoPrep);
    game._save();
  },
  onToggleSousAuto: () => {
    if (!game) return;
    game.sousChefAutoPrep = !game.sousChefAutoPrep;
    ui.syncMenuModal(game.audio.getState(), game.sousChefAutoPrep);
    game._save();
  },
  onRestartShift: (nextShift) => game && game.startShift(Boolean(nextShift)),
  onResetSave: () => game && game.resetSave(),
  onToggleLuckBoost: () => game && game.toggleLuckBoost(),
  onRollClass: () => game && game.rollChefClass(false),
  onTouchMove: (x, z) => {
    if (!game) return;
    game.touchInput.x = x;
    game.touchInput.z = z;
    if (Math.hypot(x, z) > 0.06) {
      game.cancelAutoWalk();
    }
  },
  onModalChange: (modal) => {
    if (!game) return;
    if (modal) {
      game.keys.clear();
      game.touchInput.x = 0;
      game.touchInput.z = 0;
      game.player.dashTimer = 0;
      game.player.speed = 0;
      game.cancelAutoWalk();
    } else if (game.shiftEnded) {
      // Never allow closing a modal (Gacha / Menu / Esc) to trap the player at 00:00!
      game.reopenShiftEndModal();
    }
  },
});

game = new CookingChaosGame(canvas, ui);

// ---------------- iPAD TOUCH AUTO-DETECTION & ZERO-RUNAWAY CAPTURE GUARDS ----------------
window.addEventListener(
  'touchstart',
  () => {
    game.audio.unlock();
    ui.notifyTouchPointer();
  },
  { passive: true }
);

window.addEventListener(
  'pointerdown',
  (e) => {
    game.audio.unlock();
    // Any new finger anywhere cancels pending auto-walk immediately!
    game.cancelAutoWalk();
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      ui.notifyTouchPointer();
    }
  },
  { passive: true, capture: true }
);

// Track canvas single-tap cleanly (pointercancel NEVER triggers a tap!)
const activeCanvasPointers = new Map();
let tapPointerId = null;
let tapStartX = 0;
let tapStartY = 0;
let tapMoved = false;

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e) => {
  if (e.target !== canvas) return;
  game.audio.unlock();
  game.cancelAutoWalk();
  activeCanvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activeCanvasPointers.size === 1) {
    tapPointerId = e.pointerId;
    tapStartX = e.clientX;
    tapStartY = e.clientY;
    tapMoved = false;
  } else {
    tapPointerId = null;
    tapMoved = true;
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!activeCanvasPointers.has(e.pointerId)) return;
  if (e.pointerId === tapPointerId) {
    const deadzone = e.pointerType === 'touch' ? 14 : 8;
    if (Math.hypot(e.clientX - tapStartX, e.clientY - tapStartY) > deadzone) {
      tapMoved = true;
    }
  }
});

const endCanvasPointer = (e) => {
  const wasTracked = activeCanvasPointers.delete(e.pointerId);
  if (!wasTracked) return;
  const isCleanTap = e.type === 'pointerup' && e.pointerId === tapPointerId && !tapMoved && activeCanvasPointers.size === 0;
  if (e.pointerId === tapPointerId) tapPointerId = null;
  if (isCleanTap) {
    game.handleCanvasTap(e.clientX, e.clientY);
  }
};
canvas.addEventListener('pointerup', endCanvasPointer);
canvas.addEventListener('pointercancel', endCanvasPointer);

// Order-proof touchend/touchcancel guard: if 0 fingers remain on glass, no stick or canvas pointer survives!
const releaseIfNoTouches = (e) => {
  if (e.touches && e.touches.length === 0) {
    ui.resetTouchStick();
    const stale = [...activeCanvasPointers.keys()];
    setTimeout(() => {
      for (const id of stale) activeCanvasPointers.delete(id);
      if (activeCanvasPointers.size === 0) tapPointerId = null;
    }, 0);
  }
};
window.addEventListener('touchend', releaseIfNoTouches, { passive: true });
window.addEventListener('touchcancel', releaseIfNoTouches, { passive: true });

const resetAllInputs = () => {
  game.keys.clear();
  game.cancelAutoWalk();
  game.setInput(0, 0);
  game.touchInput.x = 0;
  game.touchInput.z = 0;
  game.activeChopHold = false;
  activeCanvasPointers.clear();
  tapPointerId = null;
  ui.resetTouchStick();
};
window.addEventListener('blur', resetAllInputs);
window.addEventListener('pagehide', resetAllInputs);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) resetAllInputs();
});

// ---------------- KEYBOARD CONTROLS ----------------
window.addEventListener('keydown', (e) => {
  game.audio.unlock();
  if (e.metaKey || e.altKey || e.ctrlKey) {
    game.keys.clear();
    return;
  }
  if (e.code === 'Escape') {
    if (ui.activeModal === 'shift-end') return;
    if (ui.activeModal) ui.closeModals();
    else ui.openMenuModal(game.audio.getState(), game.sousChefAutoPrep);
    return;
  }
  if (ui.activeModal) return;

  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
  game.keys.add(e.code);
  if (!e.repeat) game.cancelAutoWalk();

  if (e.code === 'KeyF') {
    game.activeChopHold = true;
    if (!e.repeat) game.triggerSprayOrChop();
    return;
  }
  if (e.repeat) return;

  if (e.code === 'KeyE' || e.code === 'Space') {
    game.triggerPrimaryAction();
  } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    game.triggerDash();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'MetaLeft' || e.code === 'MetaRight') game.keys.clear();
  game.keys.delete(e.code);
  if (e.code === 'KeyF') game.activeChopHold = false;
});

window.addEventListener('resize', () => {
  game.resize();
  game.render();
});

// ---------------- AUTOMATION & VERIFICATION API ----------------
window.__ROBLOX_COOKING__ = {
  getState: () => game.getState(),
  step: (dt = 1 / 60, n = 1) => {
    game.step(dt, n);
    return game.getState();
  },
  render: () => game.render(),
  setInput: (x, z) => game.setInput(x, z),
  triggerPrimaryAction: () => game.triggerPrimaryAction(),
  triggerSprayOrChop: () => game.triggerSprayOrChop(),
  triggerDash: () => game.triggerDash(),
  interactStation: (id) => {
    const st = game.stationById.get(id);
    if (!st) return false;
    return game.interactWithStation(st);
  },
  teleportToStation: (id) => {
    const st = game.stationById.get(id);
    if (!st) return false;
    const stand = game._getStationStandPoint(st);
    game.player.x = stand.x;
    game.player.z = stand.z;
    game.player.yaw = Math.atan2(st.x - game.player.x, st.z - game.player.z);
    game.cancelAutoWalk();
    game._updateNearestStation();
    return true;
  },
  igniteStove: (id = 'stove_1') => game.igniteStove(id),
  finishShift: () => game.finishShift(),
  startShift: (next = false) => game.startShift(next),
  openGacha: () => ui.openGachaModal(game._getGachaUiState()),
  rollChefClass: (instant = false) => game.rollChefClass(instant),
  toggleLuckBoost: () => game.toggleLuckBoost(),
  resetSave: () => game.resetSave(),
  audio: game.audio,
  get rendererInfo() {
    return {
      calls: game.renderer.info.render.calls,
      triangles: game.renderer.info.render.triangles,
      geometries: game.renderer.info.memory.geometries,
      textures: game.renderer.info.memory.textures,
    };
  },
  _scene: game.scene,
  _camera: game.camera,
  _game: game,
  _ui: ui,
};

// ---------------- MAIN LOOP ----------------
let lastTs = performance.now();
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
  lastTs = ts;
  game.step(dt, 1);
  game.render();
}

game.render();
requestAnimationFrame(loop);
