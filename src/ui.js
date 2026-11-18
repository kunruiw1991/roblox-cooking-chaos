/**
 * Authentic Roblox HUD, iPad Touch Controls, World Progress Rings & RNG Chef Class Gacha Wheel UI
 * for Cooking Chaos (Hot Wok Studios).
 */

import * as THREE from '../vendor/three.module.min.js';
import { CHEF_CLASSES, RECIPE_BY_ID } from './config.js';

export class CookingUI {
  constructor(callbacks) {
    this.cb = callbacks;
    this.el = {
      topLeftHud: document.getElementById('top-left-hud'),
      topRightTouchHud: document.getElementById('top-right-touch-hud'),
      btnMenu: document.getElementById('btn-menu'),
      btnAudio: document.getElementById('btn-audio'),
      btnClassBadge: document.getElementById('btn-class-badge'),
      classBadgeIcon: document.getElementById('class-badge-icon'),
      classBadgeName: document.getElementById('class-badge-name'),
      orderQueue: document.getElementById('order-queue'),

      // Center Alerts
      centerAlerts: document.getElementById('center-alerts'),
      fireBanner: document.getElementById('fire-banner'),
      toastBanner: document.getElementById('toast-banner'),

      // Right-Center Thermometer
      thermoHud: document.getElementById('thermo-hud'),
      thermoFill: document.getElementById('thermo-fill'),
      thermoToque: document.getElementById('thermo-toque'),
      thermoLabel: document.getElementById('thermo-label'),

      // Desktop Bottom-Left Coins & Tip
      bottomLeftHud: document.getElementById('bottom-left-hud'),
      coinVal: document.getElementById('coin-val'),
      tipPill: document.getElementById('tip-pill'),

      // Desktop Bottom-Right Match Timer
      bottomRightHud: document.getElementById('bottom-right-hud'),
      timerText: document.getElementById('timer-text'),
      timerBarFill: document.getElementById('timer-bar-fill'),
      timerHourglass: document.getElementById('timer-hourglass'),

      // Touch Top-Right Compact Mirror (Coins + Tip + Timer so bottom corners stay 100% clear for thumbs!)
      tCoinVal: document.getElementById('t-coin-val'),
      tTipPill: document.getElementById('t-tip-pill'),
      tTimerText: document.getElementById('t-timer-text'),
      tTimerFill: document.getElementById('t-timer-fill'),

      // Desktop bottom-center key hints
      keyHintsBar: document.getElementById('key-hints-bar'),

      // World overlays
      worldBars: document.getElementById('world-bars'),
      floatPops: document.getElementById('float-pops'),

      // Touch Controls
      touchControls: document.getElementById('touch-controls'),
      stickZone: document.getElementById('touch-stick-zone'),
      stickBase: document.getElementById('touch-stick-base'),
      stickKnob: document.getElementById('touch-stick-knob'),
      touchRightBtns: document.getElementById('touch-right-btns'),
      btnTouchAction: document.getElementById('btn-touch-action'),
      btnTouchDash: document.getElementById('btn-touch-dash'),
      dashCdRing: document.getElementById('dash-cd-ring'),

      // Modals
      backdrop: document.getElementById('modal-backdrop'),
      modalMenu: document.getElementById('modal-menu'),
      btnToggleMusic: document.getElementById('btn-toggle-music'),
      btnToggleSfx: document.getElementById('btn-toggle-sfx'),
      btnToggleTouch: document.getElementById('btn-toggle-touch'),
      btnToggleSous: document.getElementById('btn-toggle-sous'),
      btnMenuClassWheel: document.getElementById('btn-menu-class-wheel'),
      btnMenuRestart: document.getElementById('btn-menu-restart'),
      btnResetSave: document.getElementById('btn-reset-save'),

      modalShiftEnd: document.getElementById('modal-shift-end'),
      endStarsRow: document.getElementById('end-stars-row'),
      endTitle: document.getElementById('end-title'),
      endCoins: document.getElementById('end-coins'),
      endServed: document.getElementById('end-served'),
      endPeakTip: document.getElementById('end-peak-tip'),
      endClassName: document.getElementById('end-class-name'),
      btnEndRollClass: document.getElementById('btn-end-roll-class'),
      btnEndRetry: document.getElementById('btn-end-retry'),
      btnEndNext: document.getElementById('btn-end-next'),

      modalGacha: document.getElementById('modal-gacha'),
      gachaTrack: document.getElementById('gacha-track'),
      gachaCoins: document.getElementById('gacha-coins'),
      gachaEquipped: document.getElementById('gacha-equipped'),
      gachaResultBox: document.getElementById('gacha-result-box'),
      btnLuckBoost: document.getElementById('btn-luck-boost'),
      btnRollClass: document.getElementById('btn-roll-class'),
    };

    this.activeModal = null;
    this._modalOpenedAt = 0;
    this.touchMode = 'auto';
    this._seenTouchPointer = false;
    this.stickPointerId = null;
    this.resetArmed = false;
    this.toastTimer = 0;
    this._lastOrderSig = '';
    this._projVec = new THREE.Vector3();
    this._barPool = [];
    this._orderPool = [];

    this._initBarPool();
    this._initOrderPool();
    this._buildGachaStrip();
    this._bindEvents();
  }

  _initOrderPool() {
    this.el.orderQueue.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const card = document.createElement('div');
      card.className = 'order-ticket hidden';
      card.innerHTML = `
        <div class="ord-head">
          <span class="ord-icon"></span>
          <span class="ord-name"></span>
        </div>
        <div class="ord-steps">
          <span class="ord-step hidden"><span class="ord-s-ico"></span><i class="ord-chk hidden">✓</i></span>
          <span class="ord-step hidden"><span class="ord-s-ico"></span><i class="ord-chk hidden">✓</i></span>
          <span class="ord-step hidden"><span class="ord-s-ico"></span><i class="ord-chk hidden">✓</i></span>
        </div>
        <div class="ord-bar"><div class="ord-bar-fill"></div></div>
      `;
      this.el.orderQueue.appendChild(card);
      const stepEls = Array.from(card.querySelectorAll('.ord-step')).map((el) => ({
        root: el,
        ico: el.querySelector('.ord-s-ico'),
        chk: el.querySelector('.ord-chk'),
      }));
      this._orderPool.push({
        root: card,
        icon: card.querySelector('.ord-icon'),
        name: card.querySelector('.ord-name'),
        steps: stepEls,
        fill: card.querySelector('.ord-bar-fill'),
      });
    }
  }

  _initBarPool() {
    for (let i = 0; i < 8; i++) {
      const div = document.createElement('div');
      div.className = 'world-bar hidden';
      div.innerHTML = `<div class="wb-lbl"></div><div class="wb-track"><div class="wb-fill"></div></div>`;
      this.el.worldBars.appendChild(div);
      this._barPool.push({
        root: div,
        lbl: div.querySelector('.wb-lbl'),
        fill: div.querySelector('.wb-fill'),
      });
    }
  }

  _buildGachaStrip() {
    this.el.gachaTrack.innerHTML = '';
    // Repeat classes 5x for smooth horizontal casino-style wheel reel!
    for (let rep = 0; rep < 5; rep++) {
      for (const cls of CHEF_CLASSES) {
        const card = document.createElement('div');
        card.className = 'gacha-card';
        card.style.borderColor = cls.color;
        card.innerHTML = `
          <div class="gc-rarity" style="background:${cls.color}">${cls.rarity}</div>
          <div class="gc-icon">${cls.icon}</div>
          <div class="gc-name">${cls.name}</div>
          <div class="gc-perk">${cls.perk}</div>
        `;
        this.el.gachaTrack.appendChild(card);
      }
    }
  }

  _bindEvents() {
    // Pointerdown + exact click-swallow (e.detail > 0) so buttons fire reliably with multi-touch,
    // resting fingers, and slow presses (5ms..5000ms) while preserving keyboard Enter/Space & .click().
    const bindBtn = (el, fn) => {
      if (!el) return;
      let handledByPointerDown = false;
      el.addEventListener('pointerdown', (e) => {
        if (e.button && e.button !== 0) return;
        if (el.disabled) return;
        handledByPointerDown = true;
        e.preventDefault();
        e.stopPropagation();
        fn();
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (handledByPointerDown) {
          handledByPointerDown = false;
          if (e.detail > 0) return;
        }
        if (el.disabled) return;
        fn();
      });
    };

    bindBtn(this.el.btnMenu, () => {
      if (this.activeModal === 'menu') this.closeModals();
      else this.cb.onOpenMenu();
    });
    bindBtn(this.el.btnAudio, () => this.cb.onToggleAllAudio());
    bindBtn(this.el.btnClassBadge, () => this.cb.onOpenGacha());

    // Modal close buttons
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      bindBtn(btn, () => this.closeModals());
    });

    // Close modal backdrop ONLY on backdrop's own pointerdown (NEVER click — slow presses >450ms never self-close!)
    this.el.backdrop.addEventListener('pointerdown', (e) => {
      if (e.target !== this.el.backdrop) return;
      if (performance.now() - (this._modalOpenedAt || 0) < 450) return;
      if (this.activeModal === 'shift-end') return;
      e.preventDefault();
      e.stopPropagation();
      this.closeModals();
    });

    // Menu buttons
    bindBtn(this.el.btnToggleMusic, () => this.cb.onToggleMusic());
    bindBtn(this.el.btnToggleSfx, () => this.cb.onToggleSfx());
    bindBtn(this.el.btnToggleTouch, () => {
      this.touchMode = this.touchMode === 'auto' ? 'on' : this.touchMode === 'on' ? 'off' : 'auto';
      this.el.btnToggleTouch.textContent = this.touchMode.toUpperCase();
    });
    bindBtn(this.el.btnToggleSous, () => this.cb.onToggleSousAuto());
    bindBtn(this.el.btnMenuClassWheel, () => this.cb.onOpenGacha());
    bindBtn(this.el.btnMenuRestart, () => {
      this.cb.onRestartShift(false);
    });
    bindBtn(this.el.btnResetSave, () => {
      if (!this.resetArmed) {
        this.resetArmed = true;
        this.el.btnResetSave.textContent = 'Confirm Reset Save?';
        return;
      }
      this.resetArmed = false;
      this.el.btnResetSave.textContent = 'Reset Save';
      this.cb.onResetSave();
    });

    // Shift-End Modal buttons
    bindBtn(this.el.btnEndRollClass, () => this.cb.onOpenGacha());
    bindBtn(this.el.btnEndRetry, () => {
      this.cb.onRestartShift(false);
    });
    bindBtn(this.el.btnEndNext, () => {
      this.cb.onRestartShift(true);
    });

    // Gacha Wheel Modal buttons
    bindBtn(this.el.btnLuckBoost, () => this.cb.onToggleLuckBoost());
    bindBtn(this.el.btnRollClass, () => this.cb.onRollClass());

    // ---------------- TRANSLUCENT ROBLOX THUMBSTICK (ZERO-RUNAWAY iPAD PATTERN) ----------------
    const stickZone = this.el.stickZone;
    const stickBase = this.el.stickBase;
    const knob = this.el.stickKnob;

    const updateStick = (clientX, clientY) => {
      const rect = stickBase.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const maxR = Math.max(24, rect.width * 0.36);
      let dx = clientX - cx;
      let dy = clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > maxR && len > 0.001) {
        dx = (dx / len) * maxR;
        dy = (dy / len) * maxR;
      }
      knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
      const norm = Math.min(1, len / maxR);
      if (norm < 0.08) {
        this.cb.onTouchMove(0, 0);
      } else {
        const rescaled = (norm - 0.08) / 0.92;
        const m = Math.max(0.001, Math.hypot(dx, dy));
        this.cb.onTouchMove((dx / m) * rescaled, (dy / m) * rescaled);
      }
    };

    stickZone.addEventListener('pointerdown', (e) => {
      // New finger always takes over — stale pointerId can NEVER latch!
      if (this.stickPointerId !== null) this.resetTouchStick();
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        this._seenTouchPointer = true;
      }
      this.stickPointerId = e.pointerId;
      stickBase.classList.add('active');
      try {
        stickZone.setPointerCapture(e.pointerId);
      } catch (_) {}
      updateStick(e.clientX, e.clientY);
      e.preventDefault();
      e.stopPropagation();
    });

    stickZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickPointerId) return;
      updateStick(e.clientX, e.clientY);
      e.preventDefault();
      e.stopPropagation();
    });

    const endStick = (e) => {
      if (e.pointerId !== this.stickPointerId) return;
      this.resetTouchStick();
      e.stopPropagation();
    };
    stickZone.addEventListener('pointerup', endStick);
    stickZone.addEventListener('pointercancel', endStick);
    stickZone.addEventListener('lostpointercapture', endStick);

    const endStickGlobal = (e) => {
      if (this.stickPointerId !== null && e.pointerId === this.stickPointerId) {
        this.resetTouchStick();
      }
    };
    window.addEventListener('pointerup', endStickGlobal, true);
    window.addEventListener('pointercancel', endStickGlobal, true);

    // Right-side tactile buttons ALL wired on pointerdown (second finger works cleanly while holding stick!)
    this.el.btnTouchAction.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.cb.onPrimaryAction();
    });
    this.el.btnTouchDash.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.cb.onDash();
    });
  }

  notifyTouchPointer() {
    this._seenTouchPointer = true;
  }

  isTouchActive() {
    if (this.touchMode === 'on') return true;
    if (this.touchMode === 'off') return false;
    const coarse = window.matchMedia && (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(any-pointer: coarse)').matches);
    const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
    return Boolean(coarse || hasTouch || this._seenTouchPointer);
  }

  resetTouchStick() {
    this.stickPointerId = null;
    if (this.el.stickBase) this.el.stickBase.classList.remove('active');
    if (this.el.stickKnob) this.el.stickKnob.style.transform = 'translate(0px, 0px)';
    this.cb.onTouchMove(0, 0);
  }

  showToast(text, dur = 2.2) {
    this.el.toastBanner.textContent = text;
    this.el.toastBanner.classList.remove('hidden');
    this.toastTimer = dur;
  }

  dismissToast() {
    this.toastTimer = 0;
    this.el.toastBanner.classList.add('hidden');
  }

  tickTransient(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.el.toastBanner.classList.add('hidden');
      }
    }
  }

  spawnFloatPop(text, worldPos, camera, width, height, color = '#facc15') {
    if (this.el.floatPops.childElementCount >= 10) {
      this.el.floatPops.firstChild.remove();
    }
    this._projVec.set(worldPos.x, worldPos.y, worldPos.z).project(camera);
    if (this._projVec.z > 1) return;
    const sx = (this._projVec.x * 0.5 + 0.5) * width;
    const sy = (-this._projVec.y * 0.5 + 0.5) * height;
    const el = document.createElement('div');
    el.className = 'float-pop';
    el.textContent = text;
    el.style.color = color;
    el.style.left = `${Math.max(48, Math.min(width - 48, sx)).toFixed(0)}px`;
    el.style.top = `${Math.max(70, Math.min(height - 90, sy)).toFixed(0)}px`;
    el.addEventListener('animationend', () => el.remove(), { once: true });
    this.el.floatPops.appendChild(el);
  }

  openMenuModal(audioState, sousAuto) {
    this.closeModals(true);
    this.activeModal = 'menu';
    this._modalOpenedAt = performance.now();
    this.resetArmed = false;
    this.el.btnResetSave.textContent = 'Reset Save';
    this.el.backdrop.classList.remove('hidden');
    this.el.modalMenu.classList.remove('hidden');
    this.syncMenuModal(audioState, sousAuto);
    this.resetTouchStick();
    this.cb.onModalChange('menu');
  }

  syncMenuModal(audioState, sousAuto) {
    this.el.btnToggleMusic.textContent = audioState.musicOn ? 'ON' : 'OFF';
    this.el.btnToggleMusic.classList.toggle('on', audioState.musicOn);
    this.el.btnToggleSfx.textContent = audioState.sfxOn ? 'ON' : 'OFF';
    this.el.btnToggleSfx.classList.toggle('on', audioState.sfxOn);
    this.el.btnToggleTouch.textContent = this.touchMode.toUpperCase();
    this.el.btnToggleSous.textContent = sousAuto ? 'ON' : 'OFF';
    this.el.btnToggleSous.classList.toggle('on', sousAuto);
  }

  openShiftEndModal(summary) {
    this.closeModals(true);
    this.activeModal = 'shift-end';
    this._modalOpenedAt = performance.now();
    this.el.backdrop.classList.remove('hidden');
    this.el.modalShiftEnd.classList.remove('hidden');

    this.el.endTitle.textContent = `SHIFT #${summary.shiftNumber} COMPLETE!`;
    this.el.endCoins.textContent = `$${summary.shiftCoins}`;
    this.el.endServed.textContent = String(summary.ordersServed);
    this.el.endPeakTip.textContent = `x${summary.peakTipMult} TIP`;
    this.el.endClassName.textContent = `${summary.equippedClass.icon} ${summary.equippedClass.name}`;

    const stars = this.el.endStarsRow.querySelectorAll('.end-star');
    stars.forEach((s, idx) => s.classList.toggle('earned', idx < summary.stars));

    this.el.btnEndRollClass.textContent = summary.freeRolls > 0 ? '🎰 ROLL CLASS (FREE!)' : '🎰 ROLL CLASS ($30)';
    this.resetTouchStick();
    this.cb.onModalChange('shift-end');
  }

  openGachaModal(state) {
    this.closeModals(true);
    this.activeModal = 'gacha';
    this._modalOpenedAt = performance.now();
    this.el.backdrop.classList.remove('hidden');
    this.el.modalGacha.classList.remove('hidden');
    this.el.gachaResultBox.textContent = 'Spin the wheel to unlock & equip a Chef Class!';
    this.el.gachaTrack.style.transform = 'translateX(0px)';
    this.syncGachaModal(state);
    this.resetTouchStick();
    this.cb.onModalChange('gacha');
  }

  syncGachaModal(state) {
    this.el.gachaCoins.textContent = `$${state.totalCoins}`;
    this.el.gachaEquipped.textContent = `${state.equippedClass.icon} ${state.equippedClass.name} (${state.equippedClass.perk})`;
    this.el.btnLuckBoost.textContent = state.luckBoostActive ? '🍀 +30% LUCK ACTIVE!' : `🍀 +30% LUCK ($${state.luckBoostCost})`;
    this.el.btnLuckBoost.classList.toggle('active', state.luckBoostActive);
    this.el.btnLuckBoost.disabled = state.spinning;
    this.el.btnRollClass.textContent = state.spinning
      ? 'SPINNING...'
      : state.freeRolls > 0
        ? '🎰 ROLL CLASS (FREE!)'
        : `🎰 ROLL CLASS ($${state.rollCost})`;
    this.el.btnRollClass.disabled = state.spinning;
  }

  startGachaSpin(targetClassId, state) {
    this.syncGachaModal(state);
    this.el.gachaResultBox.textContent = 'Rolling Chef Specialization...';
    this.updateGachaSpin(0, targetClassId);
  }

  updateGachaSpin(frac, targetClassId) {
    const idx = Math.max(0, CHEF_CLASSES.findIndex((c) => c.id === targetClassId));
    // Land on repetition #3, card idx (card width 128 + gap 10 = 138px)
    const cardPitch = 138;
    const targetCard = 3 * CHEF_CLASSES.length + idx;
    const viewportW = this.el.gachaTrack.parentElement ? this.el.gachaTrack.parentElement.clientWidth : 440;
    const endOffset = targetCard * cardPitch - viewportW * 0.5 + 64;
    // Cubic ease-out deceleration
    const eased = 1 - Math.pow(1 - Math.min(1, Math.max(0, frac)), 3);
    this.el.gachaTrack.style.transform = `translateX(${-(eased * endOffset).toFixed(1)}px)`;
  }

  finishGachaSpin(cls, state) {
    this.updateGachaSpin(1, cls.id);
    this.syncGachaModal(state);
    this.el.gachaResultBox.innerHTML = `<span style="color:${cls.color}">${cls.icon} ${cls.name} (${cls.rarity})</span> — ${cls.perk}`;
  }

  closeModals(silent = false) {
    this.activeModal = null;
    this.el.backdrop.classList.add('hidden');
    this.el.modalMenu.classList.add('hidden');
    this.el.modalShiftEnd.classList.add('hidden');
    this.el.modalGacha.classList.add('hidden');
    if (!silent) this.cb.onModalChange(null);
  }

  syncHud(s) {
    const touchOn = this.isTouchActive();
    document.body.classList.toggle('touch-device', touchOn);
    this.el.touchControls.classList.toggle('hidden', !touchOn || Boolean(this.activeModal));

    // Topbar badges
    this.el.classBadgeIcon.textContent = s.equippedClass.icon;
    this.el.classBadgeName.textContent = s.equippedClass.name;
    this.el.btnAudio.textContent = s.audio.sfxOn || s.audio.musicOn ? '🔊' : '🔇';

    // Coins & Tip Multiplier (Desktop Bottom-Left + Touch Top-Right mirror)
    const coinStr = `$${s.totalCoins}`;
    const tipStr = `x${s.tipMult} TIP`;
    this.el.coinVal.textContent = coinStr;
    this.el.tipPill.textContent = tipStr;
    this.el.tipPill.dataset.mult = String(s.tipMult);
    this.el.tCoinVal.textContent = coinStr;
    this.el.tTipPill.textContent = tipStr;
    this.el.tTipPill.dataset.mult = String(s.tipMult);

    // Round Match Timer (02:00 + animated hourglass + yellow drain bar)
    const secs = Math.ceil(s.shiftTimer);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    const timerStr = `${mm}:${ss}`;
    const pct = Math.max(0, Math.min(100, (s.shiftTimer / s.shiftDuration) * 100));
    this.el.timerText.textContent = timerStr;
    this.el.timerBarFill.style.width = `${pct.toFixed(1)}%`;
    this.el.timerBarFill.classList.toggle('urgent', secs <= 20);
    this.el.timerHourglass.classList.toggle('ticking', secs <= 30);

    this.el.tTimerText.textContent = timerStr;
    this.el.tTimerFill.style.width = `${pct.toFixed(1)}%`;
    this.el.tTimerFill.classList.toggle('urgent', secs <= 20);

    // Right-Center Performance Thermometer with Chef Toque rising with streak/combo!
    const thermoPct = Math.min(100, 12 + (s.tipMult - 1) * 29 + (s.streak > 3 ? 1 : 0));
    this.el.thermoFill.style.height = `${thermoPct.toFixed(0)}%`;
    this.el.thermoToque.style.bottom = `calc(${thermoPct.toFixed(0)}% - 14px)`;
    this.el.thermoLabel.textContent = `x${s.tipMult}`;

    // Center "PUT OUT THE FIRE!" Warning Banner
    this.el.fireBanner.classList.toggle('hidden', !s.anyFire);

    // Touch Dynamic ACTION button & Dash cooldown
    this.el.btnTouchAction.textContent = s.actionLabel;
    this.el.btnTouchAction.classList.toggle('fire-mode', s.actionLabel.includes('FIRE') || s.actionLabel.includes('EXTINGUISHER'));
    this.el.btnTouchDash.classList.toggle('cooling', s.dashCooldownFrac > 0.02);
    this.el.dashCdRing.style.opacity = s.dashCooldownFrac > 0.02 ? '0.65' : '0';

    // Order Queue horizontal tickets (re-render only when structure/checkmarks change, update bars smoothly!)
    this._syncOrders(s.orders, s.readySet);

    // World progress bars projected cleanly above active boards & stoves
    this._syncWorldBars(s.worldBars, s.camera, s.width, s.height);
  }

  _syncOrders(orders, readySet) {
    for (let i = 0; i < this._orderPool.length; i++) {
      const slot = this._orderPool[i];
      const o = orders[i];
      if (!o) {
        slot.root.classList.add('hidden');
        continue;
      }
      const r = RECIPE_BY_ID[o.recipeId];
      slot.root.classList.remove('hidden');
      slot.icon.textContent = r.icon;
      slot.name.textContent = r.name;
      for (let k = 0; k < slot.steps.length; k++) {
        const stEl = slot.steps[k];
        const st = r.steps[k];
        if (!st) {
          stEl.root.classList.add('hidden');
          continue;
        }
        const done = readySet.has(st.id);
        stEl.root.classList.remove('hidden');
        stEl.root.classList.toggle('done', done);
        stEl.ico.textContent = st.icon;
        stEl.chk.classList.toggle('hidden', !done);
      }
      const frac = Math.max(0, Math.min(1, o.timeLeft / o.maxTime));
      slot.fill.style.width = `${(frac * 100).toFixed(1)}%`;
      slot.fill.style.background = frac > 0.5 ? '#22c55e' : frac > 0.25 ? '#eab308' : '#ef4444';
    }
  }

  _syncWorldBars(bars, camera, width, height) {
    for (let i = 0; i < this._barPool.length; i++) {
      const slot = this._barPool[i];
      const b = bars[i];
      if (!b || this.activeModal) {
        slot.root.classList.add('hidden');
        continue;
      }
      this._projVec.set(b.x, b.y, b.z).project(camera);
      if (this._projVec.z > 1) {
        slot.root.classList.add('hidden');
        continue;
      }
      const sx = (this._projVec.x * 0.5 + 0.5) * width;
      const sy = (-this._projVec.y * 0.5 + 0.5) * height;
      slot.root.classList.remove('hidden');
      slot.root.style.left = `${sx.toFixed(0)}px`;
      slot.root.style.top = `${sy.toFixed(0)}px`;
      slot.lbl.textContent = b.label;
      slot.fill.style.width = `${Math.round(b.frac * 100)}%`;
      slot.fill.style.background = b.color;
    }
  }
}
