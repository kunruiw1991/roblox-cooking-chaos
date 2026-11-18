#!/usr/bin/env python3
"""Comprehensive 7-Gate E2E, Visual, Responsive, Persistence, Leak & Real CDP iPad Multi-Touch Suite
for Cooking Chaos (Hot Wok Studios) in /tmp/roblox-cooking-chaos.
"""

import asyncio
import base64
import functools
import http.server
import json
import math
import os
import re
import shutil
import subprocess
import threading
import time
import urllib.request
from pathlib import Path

from PIL import Image
import websockets

ROOT = Path('/tmp/roblox-cooking-chaos')
CAP_DIR = ROOT / 'tests' / 'captures'
PORT = 8861
CDP_PORT = 9261
CHROME_PROFILE = '/tmp/chrome_rbx_cooking'
URL = f'http://127.0.0.1:{PORT}/index.html'

CJK_RE = re.compile(r'[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]')
CDN_RE = re.compile(r'https?://', re.IGNORECASE)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    bad_requests = []

    def log_message(self, fmt, *args):
        pass

    def send_response(self, code, message=None):
        if code >= 400:
            QuietHandler.bad_requests.append((code, self.path))
        super().send_response(code, message)


def start_http_server():
    QuietHandler.bad_requests = []
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def start_chrome():
    shutil.rmtree(CHROME_PROFILE, ignore_errors=True)
    chrome_home = os.path.join(CHROME_PROFILE, 'home')
    os.makedirs(os.path.join(chrome_home, '.config'), exist_ok=True)
    os.makedirs(os.path.join(chrome_home, '.cache'), exist_ok=True)
    chrome_env = {
        'PATH': '/usr/local/bin:/usr/bin:/bin',
        'HOME': chrome_home,
        'TMPDIR': CHROME_PROFILE,
        'XDG_CONFIG_HOME': os.path.join(chrome_home, '.config'),
        'XDG_CACHE_HOME': os.path.join(chrome_home, '.cache'),
        'LANG': 'en_US.UTF-8',
    }
    cmd = [
        '/usr/bin/google-chrome',
        '--headless=new',
        '--ozone-platform=headless',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-proxy-server',
        '--disable-background-networking',
        '--disable-extensions',
        '--disable-sync',
        '--mute-audio',
        '--autoplay-policy=no-user-gesture-required',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--remote-allow-origins=*',
        f'--user-data-dir={CHROME_PROFILE}',
        f'--remote-debugging-port={CDP_PORT}',
        '--window-size=1280,800',
        'about:blank',
    ]
    proc = subprocess.Popen(cmd, env=chrome_env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    deadline = time.time() + 15.0
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    while time.time() < deadline:
        try:
            with opener.open(f'http://127.0.0.1:{CDP_PORT}/json/list', timeout=2) as r:
                pages = json.loads(r.read().decode())
                for p in pages:
                    if p.get('type') == 'page' and p.get('webSocketDebuggerUrl'):
                        return proc, p['webSocketDebuggerUrl']
        except Exception:
            time.sleep(0.15)
    proc.kill()
    raise RuntimeError('Chrome CDP failed to start')


class CDPClient:
    def __init__(self, ws):
        self.ws = ws
        self._id = 0
        self._pending = {}
        self.console_errors = []
        self.js_exceptions = []
        self.failed_requests = []
        self._reader_task = asyncio.create_task(self._reader())

    async def _reader(self):
        try:
            async for raw in self.ws:
                msg = json.loads(raw)
                if 'id' in msg:
                    fut = self._pending.pop(msg['id'], None)
                    if fut and not fut.done():
                        if 'error' in msg:
                            fut.set_exception(RuntimeError(str(msg['error'])))
                        else:
                            fut.set_result(msg.get('result', {}))
                else:
                    method = msg.get('method', '')
                    params = msg.get('params', {})
                    if method == 'Runtime.exceptionThrown':
                        ex = params.get('exceptionDetails', {})
                        txt = ex.get('text', '') + ' ' + str(ex.get('exception', {}).get('description', ''))
                        self.js_exceptions.append(txt.strip())
                    elif method == 'Runtime.consoleAPICalled':
                        if params.get('type') == 'error':
                            args = ' '.join(str(a.get('value', a.get('description', ''))) for a in params.get('args', []))
                            self.console_errors.append(args)
                    elif method == 'Log.entryAdded':
                        ent = params.get('entry', {})
                        if ent.get('level') == 'error':
                            self.console_errors.append(ent.get('text', ''))
                    elif method == 'Network.loadingFailed':
                        self.failed_requests.append(params.get('errorText', 'failed'))
        except asyncio.CancelledError:
            pass
        except Exception:
            pass

    async def send(self, method, params=None):
        self._id += 1
        cid = self._id
        fut = asyncio.get_running_loop().create_future()
        self._pending[cid] = fut
        await self.ws.send(json.dumps({'id': cid, 'method': method, 'params': params or {}}))
        return await asyncio.wait_for(fut, timeout=20.0)

    async def eval(self, expr):
        res = await self.send('Runtime.evaluate', {
            'expression': expr,
            'returnByValue': True,
            'awaitPromise': True,
        })
        if 'exceptionDetails' in res:
            raise RuntimeError(f"Eval exception: {res['exceptionDetails']}")
        return res.get('result', {}).get('value')

    async def screenshot(self, out_path, fmt='png', quality=90):
        params = {'format': fmt}
        if fmt == 'jpeg':
            params['quality'] = quality
        res = await self.send('Page.captureScreenshot', params)
        raw = base64.b64decode(res['data'])
        Path(out_path).write_bytes(raw)
        return out_path

    async def set_viewport(self, w, h, mobile=False, touch=False):
        await self.send('Emulation.setDeviceMetricsOverride', {
            'width': w,
            'height': h,
            'deviceScaleFactor': 1,
            'mobile': mobile,
        })
        await self.send('Emulation.setTouchEmulationEnabled', {
            'enabled': touch,
            'maxTouchPoints': 5 if touch else 1,
        })
        await self.eval('''(() => {
            const ui = window.__ROBLOX_COOKING__._ui;
            ui._seenTouchPointer = false;
            ui.touchMode = 'auto';
            window.dispatchEvent(new Event('resize'));
            window.__ROBLOX_COOKING__.step(1/60, 2);
            window.__ROBLOX_COOKING__.render();
        })()''')
        await asyncio.sleep(0.1)

    async def close(self):
        self._reader_task.cancel()


def gate_1_static_forensics():
    print('[G1] Static Forensics (0 CJK, 0 speechSynthesis, 0 renderer.compile, 0 CDN, 0 /google/)...')
    files = [ROOT / 'index.html', ROOT / 'css' / 'style.css'] + sorted((ROOT / 'src').glob('*.js'))
    assert len(files) >= 10, f'Expected >=10 source files, got {len(files)}'
    for f in files:
        txt = f.read_text(encoding='utf-8')
        assert not CJK_RE.search(txt), f'CJK found in {f}'
        assert 'speechSynthesis' not in txt, f'speechSynthesis found in {f}'
        assert 'renderer.compile' not in txt, f'renderer.compile found in {f}'
        assert not CDN_RE.search(txt), f'External URL/CDN found in {f}'
        assert '/google/' not in txt, f'/google/ string found in {f}'
    assert (ROOT / 'vendor' / 'three.module.min.js').exists(), 'Vendored Three.js r170 missing!'
    print(f'  PASS ({len(files)} source files + vendored Three.js r170 clean)')


async def wait_ready(cdp):
    for _ in range(80):
        if cdp.js_exceptions or cdp.console_errors:
            raise RuntimeError(f'Boot error: js={cdp.js_exceptions} console={cdp.console_errors}')
        ok = await cdp.eval('Boolean(window.__ROBLOX_COOKING__ && window.__ROBLOX_COOKING__.getState)')
        if ok:
            return
        await asyncio.sleep(0.1)
    raise RuntimeError('window.__ROBLOX_COOKING__ did not initialize')


async def run_all_gates():
    gate_1_static_forensics()
    os.makedirs(CAP_DIR, exist_ok=True)
    server = start_http_server()
    proc, ws_url = start_chrome()

    try:
        async with websockets.connect(ws_url, max_size=20 * 1024 * 1024) as ws:
            cdp = CDPClient(ws)
            await cdp.send('Runtime.enable')
            await cdp.send('Log.enable')
            await cdp.send('Page.enable')
            await cdp.send('Network.enable')

            # ---------------- G2: Boot, API, Materials & Draw Calls ----------------
            print('[G2] Boot, API window.__ROBLOX_COOKING__, Materials (metalness <= 0.22) & Draw Calls <= 85...')
            await cdp.send('Page.navigate', {'url': URL})
            await wait_ready(cdp)
            await cdp.eval('window.__ROBLOX_COOKING__.resetSave(); window.__ROBLOX_COOKING__.step(1/60, 8); window.__ROBLOX_COOKING__.render();')

            missing_api = await cdp.eval('''(() => {
                const a = window.__ROBLOX_COOKING__;
                const req = ['getState','step','render','setInput','triggerPrimaryAction','triggerSprayOrChop','triggerDash','interactStation','teleportToStation','igniteStove','finishShift','rollChefClass','resetSave','audio','rendererInfo'];
                return req.filter(k => !(k in a));
            })()''')
            assert missing_api == [], f'Missing API keys: {missing_api}'

            mat_audit = await cdp.eval('''(() => {
                const scene = window.__ROBLOX_COOKING__._scene;
                let maxMetal = 0, minRough = 1, count = 0;
                const bad = [];
                scene.traverse(o => {
                    if (!o.isMesh || !o.material) return;
                    const mats = Array.isArray(o.material) ? o.material : [o.material];
                    for (const m of mats) {
                        if (!m.isMeshStandardMaterial) continue;
                        count++;
                        if (m.metalness > maxMetal) maxMetal = m.metalness;
                        if (m.roughness < minRough) minRough = m.roughness;
                        if (m.metalness > 0.2201 || m.roughness < 0.2799) {
                            bad.push({ name: o.name, metal: m.metalness, rough: m.roughness });
                        }
                    }
                });
                return { count, maxMetal, minRough, bad };
            })()''')
            assert mat_audit['bad'] == [], f'Material violations: {mat_audit["bad"]}'
            st0 = await cdp.eval('window.__ROBLOX_COOKING__.getState()')
            assert st0['drawCalls'] <= 85, f'Initial drawCalls too high: {st0["drawCalls"]}'
            assert abs(st0['cameraRotZ']) < 1e-4, f'Camera roll non-zero: {st0["cameraRotZ"]}'
            print(f"  PASS (mats={mat_audit['count']}, maxMetal={mat_audit['maxMetal']:.2f}, minRough={mat_audit['minRough']:.2f}, drawCalls={st0['drawCalls']})")

            # ---------------- G3: Full Authentic Cooking Chaos Gameplay Loop ----------------
            print('[G3] Full Gameplay Loop (Cucumber->Chop->Rice->Boil->Plate Sushi->Serve->x2 TIP->Fire->Extinguish->Shift End->RNG Class Gacha)...')
            g3 = await cdp.eval('''(() => {
                const api = window.__ROBLOX_COOKING__;
                const g = api._game;
                api.resetSave();
                const startCoins = api.getState().totalCoins;

                // 1. Grab Raw Cucumber -> Drop on Cutting Board -> Chop into Chopped Cucumber -> Plate!
                api.teleportToStation('crate_cucumber');
                api.triggerPrimaryAction();
                const heldRawCuc = api.getState().held?.itemId;
                api.teleportToStation('board_w1');
                api.triggerPrimaryAction(); // place on board
                api.step(1/30, 95); // auto cleaver chops cleanly!
                api.triggerPrimaryAction(); // pick up chopped_cucumber
                const heldChopCuc = api.getState().held?.itemId;
                api.teleportToStation('plating_s');
                api.triggerPrimaryAction(); // plate onto clean plate on plating_s

                // 2. Grab Raw Rice -> Cook on Stove 1 -> Pick up Cooked Rice -> Plate!
                api.teleportToStation('crate_rice');
                api.triggerPrimaryAction();
                api.teleportToStation('stove_1');
                api.triggerPrimaryAction(); // drop rice into silver boiling pot
                api.step(1/30, 130); // boils into cooked_rice
                api.triggerPrimaryAction(); // take steamed rice
                const heldCookRice = api.getState().held?.itemId;
                api.teleportToStation('plating_s');
                api.triggerPrimaryAction(); // add cooked_rice to plate

                // 3. Grab Seaweed -> Add to plate -> becomes finished Sushi Roll!
                api.teleportToStation('crate_seaweed');
                api.triggerPrimaryAction();
                api.teleportToStation('plating_s');
                api.triggerPrimaryAction(); // completes sushi_roll!
                const platedDish = g.stationById.get('plating_s').item?.dishId;

                // 4. Pick up finished Sushi Roll -> Serve on Red Motorized Conveyor Belt!
                api.triggerPrimaryAction(); // pick up sushi_roll plate
                api.teleportToStation('conveyor_serve');
                api.triggerPrimaryAction(); // serve!
                api.step(1/30, 8);
                api.render();
                const afterServe = api.getState();

                // 5. Trigger NATURAL stove fire by leaving cooked patty unattended > 6s!
                api.teleportToStation('crate_patty');
                api.triggerPrimaryAction();
                api.teleportToStation('stove_3');
                api.triggerPrimaryAction();
                api.step(1/30, 125); // cooks patty
                api.step(1/30, 210); // > 6s unattended -> smokes & catches 3D blocky fire!
                api.render();
                const firesActive = api.getState().activeFires;
                const fireBannerVis = !document.getElementById('fire-banner').classList.contains('hidden');
                const callsWithFire = api.rendererInfo.calls;

                return {
                    startCoins, heldRawCuc, heldChopCuc, heldCookRice, platedDish,
                    afterServeCoins: afterServe.totalCoins,
                    shiftCoins: afterServe.shiftCoins,
                    ordersServed: afterServe.ordersServed,
                    tipMult: afterServe.tipMult,
                    firesActive, fireBannerVis, callsWithFire,
                };
            })()''')
            assert g3['heldRawCuc'] == 'raw_cucumber', f'Failed pick cucumber: {g3}'
            assert g3['heldChopCuc'] == 'chopped_cucumber', f'Failed chop cucumber: {g3}'
            assert g3['heldCookRice'] == 'cooked_rice', f'Failed cook rice: {g3}'
            assert g3['platedDish'] == 'sushi_roll', f'Failed plate sushi_roll: {g3}'
            assert g3['afterServeCoins'] > g3['startCoins'] and g3['shiftCoins'] >= 45, f'Serve coins failed: {g3}'
            assert g3['ordersServed'] == 1 and g3['tipMult'] == 2, f'Expected 1 served & x2 TIP: {g3}'
            assert 'stove_3' in g3['firesActive'] and g3['fireBannerVis'] is True, f'Natural stove fire failed: {g3}'
            assert g3['callsWithFire'] <= 85, f'Draw calls with fire > 85: {g3["callsWithFire"]}'
            await cdp.screenshot(CAP_DIR / '01_kitchen_fire_alert.png')

            # 6. Grab Red Fire Extinguisher & spray white foam to douse stove_3!
            ext = await cdp.eval('''(() => {
                const api = window.__ROBLOX_COOKING__;
                api.teleportToStation('extinguisher_mount');
                api.triggerPrimaryAction(); // grab extinguisher
                const heldKind = api.getState().held?.kind;
                api.teleportToStation('stove_3');
                // Spray foam for 1.6s
                for (let k = 0; k < 4; k++) {
                    api.triggerSprayOrChop();
                    api.step(1/30, 16);
                }
                api.render();
                const firesAfter = api.getState().activeFires;
                const fireBannerHidden = document.getElementById('fire-banner').classList.contains('hidden');
                return { heldKind, firesAfter, fireBannerHidden };
            })()''')
            assert ext['heldKind'] == 'extinguisher', f'Failed grab extinguisher: {ext}'
            assert ext['firesAfter'] == [] and ext['fireBannerHidden'] is True, f'Fire did not extinguish: {ext}'

            # 7. Finish Shift -> 3-Star Modal -> Open & Roll RNG Chef Class Gacha Wheel!
            gacha = await cdp.eval('''(() => {
                const api = window.__ROBLOX_COOKING__;
                const g = api._game;
                g.shiftCoins = 295; // ensure 3 stars visible on shift end card
                g.totalCoins = Math.max(g.totalCoins, 200);
                api.finishShift();
                api.render();
                const endOpen = !document.getElementById('modal-shift-end').classList.contains('hidden');
                const starsEarned = document.querySelectorAll('#end-stars-row .end-star.earned').length;
                api.openGacha();
                const rolledId = api.rollChefClass(false);
                api.step(1/30, 70); // finish wheel spin animation!
                api.render();
                const gachaOpen = !document.getElementById('modal-gacha').classList.contains('hidden');
                const st = api.getState();
                return { endOpen, starsEarned, rolledId, equipped: st.equippedClassId, gachaOpen, totalCoins: st.totalCoins, shiftsCompleted: st.shiftsCompleted };
            })()''')
            assert gacha['endOpen'] is True and gacha['starsEarned'] == 3, f'Shift end modal failed: {gacha}'
            assert gacha['gachaOpen'] is True and gacha['rolledId'] == gacha['equipped'], f'Gacha roll failed: {gacha}'
            await cdp.screenshot(CAP_DIR / '02_gacha_class_wheel.png')
            print(f"  PASS (Sushi Roll served +${g3['shiftCoins']} x{g3['tipMult']} TIP -> Stove Fire -> Extinguished -> 3-Star Shift End -> Gacha rolled {gacha['equipped']})")

            # ---------------- G4: Persistence Across Page.reload() ----------------
            print('[G4] Persistence Across Page.reload()...')
            pre = await cdp.eval('window.__ROBLOX_COOKING__.getState()')
            await cdp.send('Page.reload', {'ignoreCache': True})
            await wait_ready(cdp)
            await cdp.eval('window.__ROBLOX_COOKING__.step(1/60, 5); window.__ROBLOX_COOKING__.render();')
            post = await cdp.eval('window.__ROBLOX_COOKING__.getState()')
            assert post['totalCoins'] == pre['totalCoins'], f"Coins lost on reload: {post['totalCoins']} vs {pre['totalCoins']}"
            assert post['equippedClassId'] == pre['equippedClassId'], f"Class lost on reload: {post['equippedClassId']} vs {pre['equippedClassId']}"
            assert post['shiftsCompleted'] == pre['shiftsCompleted'], f"Shifts lost: {post['shiftsCompleted']}"
            assert post['bestStars'] == 3, f"Best stars lost: {post['bestStars']}"
            print(f"  PASS (totalCoins=${post['totalCoins']}, class={post['equippedClassId']}, bestStars={post['bestStars']})")

            # ---------------- G5: 2,000-Frame Leak Soak ----------------
            print('[G5] 2,000-Frame Leak Soak (geos/texs/dom flat, drawCalls <= 85)...')
            soak = await cdp.eval('''(() => {
                const api = window.__ROBLOX_COOKING__;
                api.resetSave();
                api.step(1/60, 20);
                api.render();
                const before = {
                    geos: api.rendererInfo.geometries,
                    texs: api.rendererInfo.textures,
                    dom: document.querySelectorAll('*').length,
                };
                let peakCalls = 0;
                for (let i = 0; i < 40; i++) {
                    api.setInput(Math.sin(i * 0.5), Math.cos(i * 0.5));
                    api.step(1/60, 50); // 40 * 50 = 2,000 frames!
                    if (i % 8 === 0) {
                        api.render();
                        peakCalls = Math.max(peakCalls, api.rendererInfo.calls);
                    }
                }
                api.setInput(0, 0);
                api.render();
                const after = {
                    geos: api.rendererInfo.geometries,
                    texs: api.rendererInfo.textures,
                    dom: document.querySelectorAll('*').length,
                    calls: api.rendererInfo.calls,
                };
                return { before, after, peakCalls };
            })()''')
            assert soak['after']['geos'] - soak['before']['geos'] <= 1, f'Geo leak: {soak}'
            assert soak['after']['texs'] - soak['before']['texs'] <= 0, f'Tex leak: {soak}'
            assert soak['after']['dom'] - soak['before']['dom'] <= 12, f'DOM leak: {soak}'
            assert soak['peakCalls'] <= 85, f'Peak draw calls > 85: {soak["peakCalls"]}'
            print(f"  PASS (2,000 frames: geos {soak['before']['geos']}->{soak['after']['geos']}, texs {soak['before']['texs']}->{soak['after']['texs']}, dom {soak['before']['dom']}->{soak['after']['dom']}, peakCalls={soak['peakCalls']})")

            # ---------------- G6: 6-Viewport Responsive Overlap & Zero-Scrollbar Audit ----------------
            print('[G6] 6-Viewport Responsive Overlap & Zero-Scrollbar Audit...')
            viewports = [
                (1280, 800, False, False, '1280x800'),
                (1024, 768, False, True, 'ipad_1024x768'),
                (1180, 820, False, True, 'ipad_1180x820'),
                (768, 1024, False, True, 'ipad_768x1024'),
                (844, 390, True, True, '844x390'),
                (390, 844, True, True, '390x844'),
            ]
            overlap_js = '''(() => {
                const W = window.innerWidth, H = window.innerHeight;
                const sels = [
                    '#roblox-topbar', '#order-queue', '#top-right-touch-hud', '#center-alerts',
                    '#thermo-hud', '#bottom-left-hud', '#key-hints-bar',
                    '#bottom-right-hud', '#touch-stick-zone', '#touch-right-btns'
                ];
                const boxes = [];
                for (const sel of sels) {
                    const el = document.querySelector(sel);
                    if (!el) continue;
                    const cs = getComputedStyle(el);
                    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
                    if (el.offsetParent === null && cs.position !== 'fixed') continue;
                    const r = el.getBoundingClientRect();
                    if (r.width < 2 || r.height < 2) continue;
                    boxes.push({ sel, l: r.left, t: r.top, r: r.right, b: r.bottom });
                }
                const issues = [];
                for (let i = 0; i < boxes.length; i++) {
                    const a = boxes[i];
                    if (a.l < -2 || a.t < -2 || a.r > W + 2 || a.b > H + 2) {
                        issues.push(`OFFSCREEN ${a.sel} (${a.l.toFixed(0)},${a.t.toFixed(0)},${a.r.toFixed(0)},${a.b.toFixed(0)}) in ${W}x${H}`);
                    }
                    for (let j = i + 1; j < boxes.length; j++) {
                        const b = boxes[j];
                        const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
                        const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
                        if (ox > 2 && oy > 2) {
                            issues.push(`OVERLAP ${a.sel} x ${b.sel} (${ox.toFixed(0)}x${oy.toFixed(0)}) in ${W}x${H}`);
                        }
                    }
                }
                const scroll = {
                    sw: document.documentElement.scrollWidth,
                    iw: window.innerWidth,
                    sh: document.documentElement.scrollHeight,
                    ih: window.innerHeight,
                };
                return { issues, scroll };
            })()'''

            for w, h, mob, touch, tag in viewports:
                await cdp.set_viewport(w, h, mob, touch)
                # Populate 4 orders + active fire banner + toast to stress worst-case HUD layout!
                await cdp.eval('''(() => {
                    const api = window.__ROBLOX_COOKING__;
                    const g = api._game;
                    api.resetSave();
                    g._spawnOrder('tuna_roll');
                    g._spawnOrder('sashimi_plate');
                    api.igniteStove('stove_1');
                    g.ui.showToast('🔥 Grab Extinguisher!', 5.0);
                    api.step(1/60, 4);
                    api.render();
                })()''')
                res = await cdp.eval(overlap_js)
                assert res['issues'] == [], f'{tag} HUD overlap/offscreen: {res["issues"]}'
                assert res['scroll']['sw'] <= res['scroll']['iw'] + 1 and res['scroll']['sh'] <= res['scroll']['ih'] + 1, f'{tag} scrollbar: {res["scroll"]}'

                if tag in ('ipad_1024x768', 'ipad_768x1024'):
                    await cdp.eval('''(() => {
                        const api = window.__ROBLOX_COOKING__;
                        const g = api._game;
                        api.resetSave();
                        g._spawnOrder('tuna_roll');
                        api.teleportToStation('crate_cucumber');
                        api.triggerPrimaryAction();
                        api.teleportToStation('board_c1');
                        api.triggerPrimaryAction();
                        api.step(1/30, 25);
                        api.teleportToStation('crate_rice');
                        api.triggerPrimaryAction();
                        api.teleportToStation('stove_1');
                        api.triggerPrimaryAction();
                        api.step(1/30, 30);
                        g.player.x = -0.3; g.player.z = 2.1; g.player.yaw = 0.25;
                        g.player.held = { kind: 'plate', ingredients: ['chopped_cucumber', 'cooked_rice', 'seaweed'], dishId: 'sushi_roll', dirty: false };
                        g._syncStationVisuals();
                        api.step(1/60, 4);
                        api.render();
                    })()''')
                    await cdp.screenshot(CAP_DIR / f'03_{tag}.png')

                # Verify topbar >= 44x44px touch targets on every viewport!
                top_sz = await cdp.eval('''(() => {
                    const m = document.getElementById('btn-menu').getBoundingClientRect();
                    const a = document.getElementById('btn-audio').getBoundingClientRect();
                    return { mw: m.width, mh: m.height, aw: a.width, ah: a.height };
                })()''')
                assert top_sz['mw'] >= 44 and top_sz['mh'] >= 44 and top_sz['aw'] >= 44 and top_sz['ah'] >= 44, f'{tag} topbar < 44px: {top_sz}'

                # Check zero-scrollbar modals (Menu, Shift End, Gacha)
                for modal_cmd, modal_id in [
                    ('document.getElementById("btn-menu").click()', 'modal-menu'),
                    ('window.__ROBLOX_COOKING__.finishShift()', 'modal-shift-end'),
                    ('window.__ROBLOX_COOKING__.openGacha()', 'modal-gacha'),
                ]:
                    await cdp.eval(modal_cmd)
                    await asyncio.sleep(0.04)
                    ov = await cdp.eval(f'''(() => {{
                        const m = document.getElementById("{modal_id}");
                        const r = m.getBoundingClientRect();
                        return {{ sh: m.scrollHeight, ch: m.clientHeight, b: r.bottom, H: window.innerHeight }};
                    }})()''')
                    assert ov['sh'] <= ov['ch'] + 2 and ov['b'] <= ov['H'] + 2, f'{tag} {modal_id} overflow: {ov}'
                await cdp.eval('window.__ROBLOX_COOKING__.startShift(false);')

            print('  PASS (0 overlaps, 0 offscreen, 0 scrollbars, >=44px topbar across all 6 viewports + all 3 modals!)')

            # ---------------- G7: Real CDP Input.dispatchTouchEvent iPad Multi-Touch & Zero-Runaway ----------------
            print('[G7] Real CDP Input.dispatchTouchEvent iPad Multi-Touch & Zero-Runaway Gate...')
            await cdp.set_viewport(1024, 768, False, True)
            await cdp.eval('window.__ROBLOX_COOKING__.resetSave(); window.__ROBLOX_COOKING__.step(1/60, 4); window.__ROBLOX_COOKING__.render();')

            rects = await cdp.eval('''(() => {
                const box = (id) => {
                    const r = document.getElementById(id).getBoundingClientRect();
                    return { left: r.left, top: r.top, width: r.width, height: r.height };
                };
                return {
                    touchAutoOn: !document.getElementById('touch-controls').classList.contains('hidden'),
                    s: box('touch-stick-zone'),
                    a: box('btn-touch-action'),
                    d: box('btn-touch-dash'),
                };
            })()''')
            assert rects['touchAutoOn'] is True, f'iPad touch controls failed to auto-detect in auto mode: {rects}'
            assert rects['s']['width'] >= 130, f"iPad stick < 130px: {rects['s']}"
            assert rects['a']['height'] >= 68 and rects['d']['width'] >= 68, f"Right touch buttons < 68px: {rects}"

            # 7a. Real touch hold sideways on left thumbstick -> walks right, ZERO camera yaw spin, stops cleanly on release!
            sx = rects['s']['left'] + rects['s']['width'] * 0.5
            sy = rects['s']['top'] + rects['s']['height'] * 0.5
            await cdp.send('Input.dispatchTouchEvent', {
                'type': 'touchStart',
                'touchPoints': [{'x': sx, 'y': sy, 'id': 1}],
            })
            await cdp.send('Input.dispatchTouchEvent', {
                'type': 'touchMove',
                'touchPoints': [{'x': sx + 48, 'y': sy, 'id': 1}],
            })
            walk_check = await cdp.eval('''(() => {
                const api = window.__ROBLOX_COOKING__;
                const g = api._game;
                const x0 = g.player.x;
                const yaw0 = g.camera.rotation.y;
                api.step(1/60, 40);
                const x1 = g.player.x;
                const yaw1 = g.camera.rotation.y;
                return { dx: x1 - x0, camYawDelta: Math.abs(yaw1 - yaw0), speed: g.player.speed };
            })()''')
            assert walk_check['dx'] > 2.5, f'Thumbstick did not move chef right: {walk_check}'
            assert walk_check['camYawDelta'] < 1e-5, f'Camera spun while walking sideways: {walk_check}'

            # 7b. Multi-touch: while Finger 1 STILL holds stick, Finger 2 taps right-side ACTION button near crate!
            await cdp.eval("window.__ROBLOX_COOKING__.teleportToStation('crate_cucumber');")
            ax = rects['a']['left'] + rects['a']['width'] * 0.5
            ay = rects['a']['top'] + rects['a']['height'] * 0.5
            await cdp.send('Input.dispatchTouchEvent', {
                'type': 'touchStart',
                'touchPoints': [
                    {'x': sx + 48, 'y': sy, 'id': 1},
                    {'x': ax, 'y': ay, 'id': 2},
                ],
            })
            # Release Finger 2 (ACTION) while Finger 1 STILL holds the left thumbstick!
            await cdp.send('Input.dispatchTouchEvent', {
                'type': 'touchEnd',
                'touchPoints': [{'x': ax, 'y': ay, 'id': 2}],
            })
            mt_state = await cdp.eval('''(() => {
                const g = window.__ROBLOX_COOKING__._game;
                return { heldId: g.player.held?.itemId || null, stickX: g.touchInput.x };
            })()''')
            assert mt_state['heldId'] in ('raw_cucumber', 'raw_fish', 'seaweed', 'raw_rice', 'raw_patty', 'bun'), f'Second-finger ACTION failed while thumb held stick: {mt_state}'
            assert mt_state['stickX'] > 0.5, f'Finger 1 stick lost during second-finger ACTION tap: {mt_state}'

            # Release Finger 1 -> verify chef stops cleanly with ZERO drift!
            await cdp.send('Input.dispatchTouchEvent', {
                'type': 'touchEnd',
                'touchPoints': [{'x': sx + 48, 'y': sy, 'id': 1}],
            })
            stop_check = await cdp.eval('''(() => {
                const api = window.__ROBLOX_COOKING__;
                const g = api._game;
                api.step(1/60, 4);
                const x0 = g.player.x, z0 = g.player.z;
                api.step(1/60, 60);
                return {
                    tx: g.touchInput.x, tz: g.touchInput.z,
                    speed: g.player.speed,
                    drift: Math.hypot(g.player.x - x0, g.player.z - z0),
                };
            })()''')
            assert stop_check['tx'] == 0 and stop_check['tz'] == 0 and stop_check['speed'] == 0 and stop_check['drift'] < 1e-5, f'Stick latched/drifted after release: {stop_check}'

            # 7c. touchCancel on canvas NEVER triggers tap-to-walk, and cancelling auto-walk drifts 0.00!
            await cdp.send('Input.dispatchTouchEvent', {
                'type': 'touchStart',
                'touchPoints': [{'x': 512, 'y': 350, 'id': 3}],
            })
            await cdp.send('Input.dispatchTouchEvent', {
                'type': 'touchCancel',
                'touchPoints': [],
            })
            cancel_chk = await cdp.eval('''(() => {
                const api = window.__ROBLOX_COOKING__;
                const g = api._game;
                const tapOnCancel = g.getState().hasWalkTarget;

                // Start a tap-to-walk and immediately cancel via global pointerdown capture!
                g.walkTarget = { x: 4.0, z: -2.0, stationId: null, timeLeft: 2.5, stuckTime: 0, lastDist: 5.0 };
                api.step(1/60, 6);
                const spdWalk = g.player.speed;
                window.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 99, pointerType: 'touch', clientX: 50, clientY: 50, bubbles: true }));
                const x0 = g.player.x, z0 = g.player.z;
                api.step(1/60, 45);
                const cancelDrift = Math.hypot(g.player.x - x0, g.player.z - z0);

                // Modal backdrop 450ms guard + pointerdown-only close check!
                document.getElementById('btn-menu').click();
                document.getElementById('modal-backdrop').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 77, pointerType: 'touch', bubbles: true }));
                const stillOpenGuard = !document.getElementById('modal-menu').classList.contains('hidden');
                g.ui.closeModals();
                return { tapOnCancel, spdWalk, cancelDrift, stillOpenGuard };
            })()''')
            assert cancel_chk['tapOnCancel'] is False, f'touchCancel triggered canvas tap: {cancel_chk}'
            assert cancel_chk['spdWalk'] > 3.0 and cancel_chk['cancelDrift'] < 1e-5, f'Cancelled auto-walk drifted: {cancel_chk}'
            assert cancel_chk['stillOpenGuard'] is True, f'450ms modal backdrop guard failed: {cancel_chk}'
            print(f"  PASS (stick={rects['s']['width']:.0f}px, ACTION={rects['a']['height']:.0f}px, camYawDelta=0.00, 2nd-finger ACTION OK, stopDrift=0.00, cancelDrift=0.00)")

            # ---------------- G8: Fable Audit Regressions (#1 Crash/rAF, #2 Shift-End Softlock, #3 361/361 Tap Matrix, #4 Slow-Press & Resting-Finger Multi-Touch) ----------------
            print('[G8] Audit Regressions (#1 stuck-cancel crash, #2 shift-end softlock, #3 361/361 station taps, #4 700ms slow-press & resting-finger buttons)...')
            # 8a. #1 Stuck cancelAutoWalk null-deref regression + live rAF survival check
            t_before = await cdp.eval('''(() => {
                const api = window.__ROBLOX_COOKING__;
                const g = api._game;
                api.resetSave();
                g.walkTarget = { x: g.player.x + 5, z: g.player.z, waypoints: [{ x: g.player.x + 5, z: g.player.z }], wpIdx: 0, stationId: null, timeLeft: 2, stuckTime: 0.6, lastDist: 0 };
                api.step(1/60, 2); // triggers stuckTime > 0.55 -> cancelAutoWalk()!
                return { wtNull: g.walkTarget === null, t0: g.time };
            })()''')
            assert t_before['wtNull'] is True, f'Stuck walkTarget not cleared: {t_before}'
            await asyncio.sleep(0.18)
            t_after = await cdp.eval('window.__ROBLOX_COOKING__._game.time')
            assert t_after > t_before['t0'] + 0.02, f'rAF loop stalled after stuck cancel: {t_before["t0"]} -> {t_after}'

            # 8b. #3 Exhaustive 19/19 from spawn + 361/361 station-to-station tap-to-walk matrix!
            matrix = await cdp.eval('''(() => {
                const api = window.__ROBLOX_COOKING__;
                const g = api._game;
                const rect = g.canvas.getBoundingClientRect();
                const proj = new (g.camera.position.constructor)();
                const tapStation = (st) => {
                    proj.set(st.x, 0.95, st.z).project(g.camera);
                    const sx = rect.left + (proj.x * 0.5 + 0.5) * rect.width;
                    const sy = rect.top + (-proj.y * 0.5 + 0.5) * rect.height;
                    return g.handleCanvasTap(sx, sy);
                };
                const ids = g.stations.map(s => s.id);
                let spawnOk = 0;
                const spawnFails = [];
                for (const id of ids) {
                    api.startShift(false);
                    const st = g.stationById.get(id);
                    tapStation(st);
                    for (let k = 0; k < 240; k++) {
                        api.step(1/60, 1);
                        if (!g.walkTarget) break;
                    }
                    const d = Math.hypot(g.player.x - st.x, g.player.z - st.z);
                    if (d <= 2.45) spawnOk++;
                    else spawnFails.push({ id, d: Number(d.toFixed(2)), pos: [Number(g.player.x.toFixed(2)), Number(g.player.z.toFixed(2))] });
                }
                let pairOk = 0;
                const pairFails = [];
                for (const a of ids) {
                    for (const b of ids) {
                        api.startShift(false);
                        api.teleportToStation(a);
                        const stB = g.stationById.get(b);
                        tapStation(stB);
                        for (let k = 0; k < 280; k++) {
                            api.step(1/60, 1);
                            if (!g.walkTarget) break;
                        }
                        const d = Math.hypot(g.player.x - stB.x, g.player.z - stB.z);
                        if (d <= 2.45) pairOk++;
                        else pairFails.push({ a, b, d: Number(d.toFixed(2)) });
                    }
                }
                return { spawnOk, total: ids.length, spawnFails, pairOk, totalPairs: ids.length * ids.length, pairFails: pairFails.slice(0, 8) };
            })()''')
            assert matrix['spawnOk'] == matrix['total'], f'Spawn tap-to-walk failed: {matrix["spawnFails"]}'
            assert matrix['pairOk'] == matrix['totalPairs'], f'Station-to-station matrix failed ({matrix["pairOk"]}/{matrix["totalPairs"]}): {matrix["pairFails"]}'

            # 8c. #2 Shift-end zero softlock + player.speed === 0 + resting-finger Next Shift!
            await cdp.eval('''(() => {
                const api = window.__ROBLOX_COOKING__;
                const g = api._game;
                api.startShift(false);
                api.setInput(1, 0);
                api.step(1/60, 10);
                api.finishShift();
            })()''')
            se1 = await cdp.eval('''(() => {
                const g = window.__ROBLOX_COOKING__._game;
                return { speed: g.player.speed, modal: g.ui.activeModal, shiftEnded: g.shiftEnded };
            })()''')
            assert se1['speed'] == 0 and se1['modal'] == 'shift-end' and se1['shiftEnded'] is True, f'finishShift state bad: {se1}'

            # Open ROLL CLASS from Shift End -> spin -> close Gacha ✕ -> MUST return cleanly to Shift End (NO softlock!)
            await cdp.eval('''(() => {
                const api = window.__ROBLOX_COOKING__;
                document.getElementById('btn-end-roll-class').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 41, pointerType: 'touch', bubbles: true }));
                api.rollChefClass(false);
                api.step(1/30, 70);
                document.querySelector('#modal-gacha [data-close-modal]').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 42, pointerType: 'touch', bubbles: true }));
            })()''')
            se2 = await cdp.eval('''(() => {
                const g = window.__ROBLOX_COOKING__._game;
                return { modal: g.ui.activeModal, endHidden: document.getElementById('modal-shift-end').classList.contains('hidden') };
            })()''')
            assert se2['modal'] == 'shift-end' and se2['endHidden'] is False, f'Shift-end softlock after closing Gacha: {se2}'

            # Test real touch Next Shift while another finger rests on the glass!
            next_box = await cdp.eval('''(() => {
                const r = document.getElementById('btn-end-next').getBoundingClientRect();
                return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
            })()''')
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 80, 'y': 700, 'id': 11}]})
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 80, 'y': 700, 'id': 11}, {'x': next_box['x'], 'y': next_box['y'], 'id': 12}]})
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': [{'x': next_box['x'], 'y': next_box['y'], 'id': 12}]})
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': [{'x': 80, 'y': 700, 'id': 11}]})
            se3 = await cdp.eval('window.__ROBLOX_COOKING__.getState()')
            assert se3['shiftEnded'] is False and se3['shiftTimer'] > 110, f'Next Shift failed with resting finger: {se3}'

            # 8d. #4 Real 700ms slow press on ☰ Menu & Class Wheel pill (never self-closes on release, never double-fires!) + ☰ works while thumb holds stick!
            btn_boxes = await cdp.eval('''(() => {
                const c = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 }; };
                return { menu: c('btn-menu'), badge: c('btn-class-badge'), stick: c('touch-stick-zone') };
            })()''')
            # 700ms slow press on Class Wheel pill -> must stay OPEN on release!
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': btn_boxes['badge']['x'], 'y': btn_boxes['badge']['y'], 'id': 21}]})
            await asyncio.sleep(0.70)
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': [{'x': btn_boxes['badge']['x'], 'y': btn_boxes['badge']['y'], 'id': 21}]})
            await asyncio.sleep(0.06)
            slow_gacha = await cdp.eval('window.__ROBLOX_COOKING__._ui.activeModal')
            assert slow_gacha == 'gacha', f'700ms slow press on Class Wheel self-closed or failed: {slow_gacha}'
            await cdp.eval('window.__ROBLOX_COOKING__._ui.closeModals();')

            # 700ms slow press on ☰ Menu while Finger 1 holds left thumbstick -> must OPEN and STAY open!
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': btn_boxes['stick']['x'] + 35, 'y': btn_boxes['stick']['y'], 'id': 31}]})
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': btn_boxes['stick']['x'] + 35, 'y': btn_boxes['stick']['y'], 'id': 31}, {'x': btn_boxes['menu']['x'], 'y': btn_boxes['menu']['y'], 'id': 32}]})
            await asyncio.sleep(0.70)
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': [{'x': btn_boxes['menu']['x'], 'y': btn_boxes['menu']['y'], 'id': 32}]})
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': [{'x': btn_boxes['stick']['x'] + 35, 'y': btn_boxes['stick']['y'], 'id': 31}]})
            await asyncio.sleep(0.06)
            slow_menu = await cdp.eval('window.__ROBLOX_COOKING__._ui.activeModal')
            assert slow_menu == 'menu', f'700ms slow press on ☰ while holding stick failed/toggled twice: {slow_menu}'
            await cdp.eval('window.__ROBLOX_COOKING__._ui.closeModals();')

            print(f"  PASS (stuck-cancel rAF OK, {matrix['spawnOk']}/19 spawn & {matrix['pairOk']}/361 pair taps OK, shift-end zero softlock, 700ms slow-press & multi-touch buttons OK!)")

            # ---------------- Hero 1280x800 screenshot.jpg ----------------
            await cdp.set_viewport(1280, 800, False, False)
            await cdp.eval('''(() => {
                const api = window.__ROBLOX_COOKING__;
                const g = api._game;
                api.resetSave();
                g.totalCoins = 305;
                g.streak = 3; // x4 TIP & rising chef toque thermometer!
                g.shiftTimer = 112;
                g._spawnOrder('tuna_roll');
                // Place lively active prep across the kitchen:
                // - Chopping cucumber on West board
                g.stationById.get('board_w1').item = { kind: 'item', itemId: 'raw_cucumber' };
                g.stationById.get('board_w1').progress = 0.62;
                // - Boiling rice on Stove 1 & searing patty on Stove 3
                g.stationById.get('stove_1').item = { kind: 'item', itemId: 'raw_rice' };
                g.stationById.get('stove_1').progress = 0.72;
                g.stationById.get('stove_3').item = { kind: 'item', itemId: 'cooked_patty' };
                g.stationById.get('stove_3').progress = 1.0;
                // - Finished Chef Burger plated on Center Island
                g.stationById.get('prep_c2').item = { kind: 'plate', ingredients: ['cooked_patty', 'bun'], dishId: 'chef_burger', dirty: false };
                // - Serve a Tuna Roll live so a real plated dish glides out on the Red Motorized Conveyor Belt + confetti!
                g._serveDish('tuna_roll');
                g.totalCoins = 305;
                g.streak = 3; // x4 TIP & rising chef toque thermometer!
                g.ui.dismissToast();
                // - Chef Player prominently walking near center-south carrying a finished Sushi Roll overhead!
                g.player.x = -0.6;
                g.player.z = 2.05;
                g.player.yaw = 0.25;
                g.player.held = { kind: 'plate', ingredients: ['chopped_cucumber', 'cooked_rice', 'seaweed'], dishId: 'sushi_roll', dirty: false };
                g._syncStationVisuals();
                api.step(1/30, 10);
                api.render();
            })()''')
            await asyncio.sleep(0.08)
            hero_png = CAP_DIR / 'hero_1280x800.png'
            await cdp.screenshot(hero_png)
            Image.open(hero_png).convert('RGB').save(ROOT / 'screenshot.jpg', quality=92)
            # Reset clean save so fresh boot starts cleanly
            await cdp.eval('window.__ROBLOX_COOKING__.resetSave();')

            # Final Error Check
            assert cdp.js_exceptions == [], f'JS exceptions: {cdp.js_exceptions}'
            assert cdp.console_errors == [], f'Console errors: {cdp.console_errors}'
            assert cdp.failed_requests == [], f'Failed network requests: {cdp.failed_requests}'
            assert QuietHandler.bad_requests == [], f'HTTP >=400 requests: {QuietHandler.bad_requests}'

            await cdp.close()
            print('\nALL 8 GATES PASSED WITH 0 ERRORS!')
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        server.shutdown()
        shutil.rmtree(CHROME_PROFILE, ignore_errors=True)


if __name__ == '__main__':
    asyncio.run(run_all_gates())
