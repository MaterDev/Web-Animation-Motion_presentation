// @ts-nocheck -- written for the deck beside copied sheet code; untyped like it
/* composite/finale — the last slide.
   A credits screen that fills the slide, and every surface in the talk is on
   it: the names are page elements with a CSS reveal, the heading a variable-
   font weight wave, an SVG line network draws itself on behind them, slime
   GIFs sit in the grid, the NOVA-7 film loops in a tile, an oil slick runs on a
   2D canvas, and the ground and its particles are WebGPU. Then the camera pulls
   back: the screen is the inner display of the fPhone Duo (duo.js, sphere
   traced), which sleeps and folds shut.

   The composite mechanics from the paper, literally: one timeline gives the
   camera zoom z; hw.rectAt(z) projects the display's corners through the same
   camera the shader uses; the page layer gets one transform from that rect in
   the same frame the GPU draws. One clock, one source of truth, no drift. */
import css from './demo.css?raw';
import html from './demo.html?raw';
import { stage } from '../../_kit/stage.js';
import { disposer } from '../../_kit/disposer.js';
import { getDevice, releaseDevice, format, DPR, cssRGB } from './common.js';
import { makeHardware, ease, LAYER_W, LAYER_H, LAYER_RADIUS } from './duo.js';
import { makeSlick } from './slick.js';

const EXTENDA = new URL('./assets/fonts/extenda-20-micro.woff2', import.meta.url).href;
const VIDEO = new URL('./assets/nova7-explode-16x9.mp4', import.meta.url).href;
const GIF = ['slime-idle', 'slime-happy', 'slime-eat'].map((n) => new URL(`./assets/${n}.gif`, import.meta.url).href);
const NAMES = ['Sean Van Dyk', 'Irene Polo', 'Aayush Joshi', 'Tyler Knight', 'Kyle Johnson', 'Kayla Long', 'Mike Matheny'];
/* ms: pull back; then wait on the open device for close ▸ (Key: closing is a click); screen to sleep, fold; then an idle before replay is offered */
const DUR = { zoom: 2200, hold: 0, sleep: 500, fold: 1400, idle: 4000, auto: 4000, settle: 300 };
const END = DUR.zoom + DUR.hold + DUR.sleep + DUR.fold;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
/* the coordinate dots, in the field's 864 × 432 units (Key: keep the dots, no connecting lines) */
const NODES = [[26, 101], [168, 146], [318, 109], [492, 152], [548, 39], [566, 208], [812, 325], [540, 298], [346, 309], [132, 307], [34, 229], [836, 43], [700, 391],
  [420, 30], [250, 60], [600, 110], [760, 270], [90, 400], [470, 400], [390, 230]];
/* tell the deck the phone is leaving the slide: it drops its chrome and paints the window white (Deck.svelte) */
const takeover = (on) => { try { window.dispatchEvent(new CustomEvent('wam-deck-takeover', { detail: { on } })); } catch {} };

/** @param {HTMLElement} host */
export function mount(host) {
  const { root, $ } = stage(host, { css, html });
  const d = disposer();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const el = $('finale'), canvas = $('finale-gpu'), screen = $('finale-screen'), video = $('finale-video-el');
  const playBtn = $('finale-play'), closeBtn = $('finale-close'), replayBtn = $('finale-replay'), endLine = $('finale-end');
  let gone = false, dev = null, hw = null, ctx = null, colors = null, raf = 0, autoT = 0, drewOnce = false, idleDrawn = false;
  let t0 = performance.now(), playAt = null, closeAt = null, hold = null;

  /* markup the data owns */
  screen.style.setProperty('--fn-lh', LAYER_H + 'px'); screen.style.setProperty('--fn-radius', LAYER_RADIUS + 'px'); screen.style.setProperty('--fn-band-top', (LAYER_H - 540) / 2 + 'px');
  screen.classList.add('fn-css-ground');
  $('finale-title').innerHTML = [...'with thanks'].map((ch, i) => ch === ' ' ? `<span class="sp" aria-hidden="true" style="--i:${i}"> </span>` : `<span aria-hidden="true" style="--i:${i}">${ch}</span>`).join('');
  $('finale-names').innerHTML = NAMES.map((n, i) => { const key = n.toLowerCase().replace(/\s+/g, '-');
    return `<li class="fn-name" style="--i:${i}" data-testid="finale-name-${key}"><i aria-hidden="true">${String(i + 1).padStart(2, '0')}</i><span data-testid="finale-name-${key}-label">${n}</span></li>`; }).join('')
    + `<li class="fn-slimes" aria-hidden="true" data-testid="finale-slimes">${GIF.map((src) => `<img src="${src}" alt="" draggable="false">`).join('')}</li>`;
  const svg = $('finale-dots'), NS = 'http://www.w3.org/2000/svg';
  NODES.forEach(([x, y], i) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y)); c.setAttribute('r', i % 4 === 0 ? '2.6' : '1.8'); c.style.setProperty('--i', String(i)); svg.append(c);
    if (i % 4 === 0) { const t = document.createElementNS(NS, 'path'); t.setAttribute('d', `M${x - 7} ${y}h4M${x + 3} ${y}h4M${x} ${y - 7}v4M${x} ${y + 3}v4`); t.style.setProperty('--i', String(i)); svg.append(t); } });

  const tokens = getComputedStyle(el);
  const slickGround = cssRGB(tokens.getPropertyValue('--lcd-ground-bot').trim()).slice(0, 3).map((v) => v * 255);
  const drawSlick = makeSlick($('finale-slick'), slickGround);

  const live = () => { screen.classList.remove('is-live'); void screen.offsetWidth; screen.classList.add('is-live'); };
  const startVideo = () => { if (reduced.matches) { video.pause(); if (video.readyState >= 1) video.currentTime = 2.6; return; } video.play().catch(() => {}); };
  video.src = VIDEO;
  d.on(video, 'loadedmetadata', () => { if (reduced.matches) video.currentTime = 2.6; });
  startVideo(); live();

  /* no auto-start: Key starts the pull-back himself, by tap (phone), click, Space or Enter */
  const armAuto = () => { clearTimeout(autoT); };
  d.add(() => clearTimeout(autoT));
  function play() { if (!hw || playAt !== null) return; clearTimeout(autoT);
    playAt = reduced.matches ? performance.now() - DUR.zoom : performance.now(); idleDrawn = false; playBtn.classList.add('gone'); playBtn.blur?.(); takeover(true); el.focus({ preventScroll: true }); }
  function close() { if (!hw || playAt === null || closeAt !== null || closeBtn.hidden) return;
    closeAt = reduced.matches ? performance.now() - DUR.sleep - DUR.fold : performance.now(); idleDrawn = false;
    closeBtn.classList.remove('on'); closeBtn.hidden = true; el.style.cursor = ''; el.focus({ preventScroll: true }); }
  function replay() { if (playAt === null) return; takeover(false); playAt = null; closeAt = null; hold = null; idleDrawn = false; t0 = performance.now();
    replayBtn.classList.remove('on'); replayBtn.hidden = true; endLine.classList.remove('on'); playBtn.classList.remove('gone');
    screen.style.visibility = ''; live(); startVideo(); armAuto(); el.focus({ preventScroll: true }); }
  d.on(playBtn, 'click', play);
  d.on(closeBtn, 'click', close);
  /* once open and waiting, the device itself is the close control: a click inside its projected body closes it */
  const onDevice = (e) => { if (!hw || closeBtn.hidden || closeAt !== null) return false; const r = canvas.getBoundingClientRect(), B = hw.boundsOpen();
    const px = (e.clientX - r.left) * canvas.width / r.width, py = (e.clientY - r.top) * canvas.height / r.height;
    return px >= B.x && px <= B.x + B.w && py >= B.y && py <= B.y + B.h; };
  d.on(el, 'click', (e) => { if (e.target.closest && e.target.closest('button')) return; if (onDevice(e)) close(); });
  d.on(el, 'pointermove', (e) => { el.style.cursor = onDevice(e) ? 'pointer' : ''; });
  d.on(replayBtn, 'click', replay);
  d.on(el, 'keydown', (e) => { if (e.target !== el || (e.key !== ' ' && e.key !== 'Enter')) return; e.preventDefault(); if (playAt === null) play(); else if (!closeBtn.hidden) close(); else if (!replayBtn.hidden) replay(); });
  d.on(el, 'pointermove', () => { if (playAt === null) armAuto(); });
  /* the phone remote taps the same sequence forward: pull back, close, replay */
  d.on(window, 'wam-deck-tap', () => { if (playAt === null) play(); else if (!closeBtn.hidden) close(); else if (!replayBtn.hidden) replay(); });

  /* the screen layer's transform from a display rect in device px; without a GPU, the same rect the camera gives at z = 0 */
  /* the slide re-lays out to the display as the camera pulls back: its box grows from the 540 px band to the display's full height, its bezel thins away */
  const slideEl = $('finale-slide'), wellEl = slideEl.querySelector('.fn-well'); let lastGrow = -1;
  const grow = (g) => { if (Math.abs(g - lastGrow) < 1e-4) return; lastGrow = g;
    slideEl.style.top = ((LAYER_H - 540) / 2) * (1 - g) + 'px'; slideEl.style.height = 540 + (LAYER_H - 540) * g + 'px'; wellEl.style.padding = 6 * (1 - g) + 'px'; };
  const place = (R, k) => { screen.style.transform = `translate(${R.x * k}px, ${R.y * k}px) scale(${R.w * k / LAYER_W})`; };
  const cssRect = () => { const cw = el.clientWidth, ch = el.clientHeight, w = cw, h = w * LAYER_H / LAYER_W; return { x: (cw - w) / 2, y: (ch - h) / 2, w, h }; };
  const fitCanvas = () => { const r = canvas.getBoundingClientRect(); const w = Math.max(2, Math.round(r.width * DPR)), h = Math.max(2, Math.round(r.height * DPR)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; } return false; };

  /* one frame from one time: everything below is a function of (now − t0) and (now − playAt) */
  const frame = (now) => {
    /* one timeline: the zoom runs from the trigger and stops at its end; past that, time only moves once close ▸ is pressed */
    const T = hold !== null ? hold : playAt === null ? -1 : closeAt === null ? Math.min(now - playAt, DUR.zoom) : DUR.zoom + DUR.hold + (now - closeAt);
    const waiting = playAt !== null && closeAt === null && (hold === null ? now - playAt >= DUR.zoom + DUR.settle : hold >= DUR.zoom && hold < DUR.zoom + DUR.hold + 1);
    if (waiting && closeBtn.hidden) { closeBtn.hidden = false; requestAnimationFrame(() => closeBtn.classList.add('on')); }
    const sec = reduced.matches ? 3 : ((hold !== null && playAt === null ? hold : now - t0) / 1000);
    let z = 0, awake = 1, pose = 1, openness = 1, outer = 0, still = true, foldP = 0;
    if (T >= 0) {
      z = ease(T / DUR.zoom);
      const sp = clamp01((T - DUR.zoom - DUR.hold) / DUR.sleep); awake = 1 - sp;
      foldP = clamp01((T - DUR.zoom - DUR.hold - DUR.sleep) / DUR.fold);
      pose = 1 - foldP; openness = 1 - ease((foldP - 0.02) / 0.86); /* outer stays 0: the device closes asleep, the outer display dark */
      still = !(T < DUR.zoom || (foldP > 0 && foldP < 1));
    }
    /* page layer */
    screen.style.opacity = String(awake);
    screen.style.visibility = awake <= 0 ? 'hidden' : '';
    if (awake <= 0 && !video.paused) video.pause();
    if (awake > 0 && !reduced.matches) drawSlick(sec); else if (!drewOnce) drawSlick(sec);
    endLine.classList.toggle('on', T >= END);
    if (T >= END + DUR.idle && replayBtn.hidden) { replayBtn.hidden = false; requestAnimationFrame(() => replayBtn.classList.add('on')); }
    if (!hw) { place(cssRect(), 1); raf = requestAnimationFrame(frame); return; }
    if (fitCanvas()) { hw.resize(); idleDrawn = false; }
    const k = canvas.clientWidth / canvas.width;
    const R = hw.rectAt(z);
    /* the slide grows exactly as the display's edges come into view: whatever part of the display is on the canvas is slide, never letterbox */
    const g = clamp01((canvas.height * LAYER_W / R.w - 540) / (LAYER_H - 540));
    place(R, k); grow(g);
    /* GPU: once closed and converged, the canvas keeps its last frame and nothing is drawn */
    if (!idleDrawn) {
      const enc = dev.createCommandEncoder();
      const accumulating = hw.body(enc, pose, z, Math.PI - openness * Math.PI, outer, still);
      hw.composite(enc, { rect: R, awake, settled: foldP === 0, grow: g, time: sec, fade: 1, colors });
      dev.queue.submit([enc.finish()]);
      if (!drewOnce) { drewOnce = true; screen.classList.remove('fn-css-ground'); }
      if (T >= END && !accumulating) idleDrawn = true;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  d.add(() => cancelAnimationFrame(raf));

  /* FOLKLORE, in Folklore Digital's display face (Extenda 20 Micro, uppercase as their site sets it), rasterised once
     into a canvas cropped to the ink, for the GPU to etch on the closed device. Falls back to a condensed system face. */
  let face = null;
  const wordmark = async () => {
    let family = 'sans-serif';
    try { face = new FontFace('FinaleExtenda', `url(${EXTENDA})`); await Promise.race([face.load(), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 3000))]); document.fonts.add(face); family = 'FinaleExtenda'; }
    catch (e) { console.info('finale: Extenda did not load, using a system face —', e.message); face = null; }
    const c = document.createElement('canvas'), x = c.getContext('2d'), size = 220, word = 'FOLKLORE';
    x.font = `${size}px ${family}`; x.letterSpacing = '6px';
    const m = x.measureText(word), pad = 16, w = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2, h = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + pad * 2;
    c.width = w; c.height = h; x.font = `${size}px ${family}`; x.letterSpacing = '6px'; x.fillStyle = '#fff';
    x.fillText(word, pad + m.actualBoundingBoxLeft, pad + m.actualBoundingBoxAscent);
    return { image: c, aspect: w / h };
  };
  d.add(() => { if (face) document.fonts.delete(face); });

  playBtn.classList.add('gone');
  (async () => {
    try { dev = await getDevice(); } catch (e) { console.info('finale: no WebGPU, credits stay a still screen —', e.message); return; }
    if (gone) { releaseDevice(dev); return; }
    dev.lost.then((info) => { if (gone) return; console.warn('finale: device lost', info.message); hw = null; screen.classList.add('fn-css-ground'); playBtn.classList.add('gone'); });
    colors = { top: cssRGB(tokens.getPropertyValue('--lcd-ground-top').trim()), bot: cssRGB(tokens.getPropertyValue('--lcd-ground-bot').trim()),
      ink: cssRGB(tokens.getPropertyValue('--lcd-ink').trim()), tint: cssRGB(tokens.getPropertyValue('--tint-composite').trim()), well: cssRGB(tokens.getPropertyValue('--well-floor').trim()) };
    ctx = canvas.getContext('webgpu'); ctx.configure({ device: dev, format, alphaMode: 'premultiplied' });
    const mark = await wordmark();
    if (gone) { releaseDevice(dev); return; }
    fitCanvas(); hw = makeHardware(dev, canvas, ctx, format, mark); hw.resize();
    playBtn.classList.remove('gone'); armAuto();
  })();

  /* a verification handle on the element: freeze the timeline at T ms after the trigger (null resumes), or read it */
  canvas.__finale = { play, replay, close, seek: (ms) => { if (ms !== null && playAt === null) { playAt = performance.now(); playBtn.classList.add('gone'); } if (ms !== null && ms > DUR.zoom && closeAt === null) { closeAt = performance.now() - (ms - DUR.zoom); closeBtn.hidden = true; } hold = ms; idleDrawn = false; clearTimeout(autoT); },
    state: () => ({ ready: !!hw, playAt, closeAt, hold, END }) };

  return () => {
    gone = true;
    if (playAt !== null) takeover(false);
    d.run();
    video.pause(); video.removeAttribute('src'); video.load();
    if (hw) { hw.destroy(); hw = null; }
    if (ctx) { try { ctx.unconfigure(); } catch {} }
    releaseDevice(dev);
    delete canvas.__finale;
    root.innerHTML = '';
  };
}
