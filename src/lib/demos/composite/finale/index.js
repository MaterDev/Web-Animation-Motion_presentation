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

const VIDEO = new URL('./assets/nova7-explode-16x9.mp4', import.meta.url).href;
const GIF = ['slime-idle', 'slime-happy', 'slime-eat'].map((n) => new URL(`./assets/${n}.gif`, import.meta.url).href);
const NAMES = ['Sean Van Dyk', 'Irene Polo', 'Aayush Joshi', 'Tyler Knight', 'Kyle Johnson', 'Kayla Long', 'Mike Matheny'];
/* ms: pull back, hold on the device, screen to sleep, fold; then an idle before replay is offered */
const DUR = { zoom: 2200, hold: 1000, sleep: 500, fold: 1400, idle: 4000, auto: 4000 };
const END = DUR.zoom + DUR.hold + DUR.sleep + DUR.fold;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
/* the line network, in the credits band's 864 × 444 units */
const NODES = [[26, 104], [168, 150], [318, 112], [492, 156], [548, 40], [566, 214], [812, 334], [540, 306], [346, 318], [132, 316], [34, 236], [836, 44], [700, 402]];
const LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 11], [3, 5], [5, 7], [7, 6], [7, 8], [8, 9], [9, 10], [10, 0], [6, 12], [2, 8], [5, 6]];

/** @param {HTMLElement} host */
export function mount(host) {
  const { root, $ } = stage(host, { css, html });
  const d = disposer();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const el = $('finale'), canvas = $('finale-gpu'), screen = $('finale-screen'), video = $('finale-video-el');
  const playBtn = $('finale-play'), replayBtn = $('finale-replay'), endLine = $('finale-end');
  let gone = false, dev = null, hw = null, ctx = null, colors = null, raf = 0, autoT = 0, drewOnce = false, idleDrawn = false;
  let t0 = performance.now(), playAt = null, hold = null;

  /* markup the data owns */
  screen.style.setProperty('--fn-lh', LAYER_H + 'px'); screen.style.setProperty('--fn-radius', LAYER_RADIUS + 'px'); screen.style.setProperty('--fn-band-top', (LAYER_H - 444) / 2 + 'px');
  screen.classList.add('fn-css-ground');
  $('finale-title').innerHTML = [...'with thanks'].map((ch, i) => ch === ' ' ? `<span class="sp" aria-hidden="true" style="--i:${i}"> </span>` : `<span aria-hidden="true" style="--i:${i}">${ch}</span>`).join('');
  $('finale-names').innerHTML = NAMES.map((n, i) => { const key = n.toLowerCase().replace(/\s+/g, '-');
    return `<li class="fn-name" style="--i:${i}" data-testid="finale-name-${key}"><i aria-hidden="true">${String(i + 1).padStart(2, '0')}</i><span data-testid="finale-name-${key}-label">${n}</span></li>`; }).join('')
    + `<li class="fn-slimes" aria-hidden="true" data-testid="finale-slimes">${GIF.map((src) => `<img src="${src}" alt="" draggable="false">`).join('')}</li>`;
  const svg = $('finale-lines'), NS = 'http://www.w3.org/2000/svg';
  LINKS.forEach(([a, b], i) => { const [x1, y1] = NODES[a], [x2, y2] = NODES[b], mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1);
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', `M${x1} ${y1}Q${mx} ${my - len * 0.32} ${x2} ${y2}`); p.setAttribute('pathLength', '1'); p.style.setProperty('--i', String(i)); svg.append(p); });
  NODES.forEach(([x, y], i) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y)); c.setAttribute('r', '2.2'); c.style.setProperty('--i', String(i)); svg.append(c); });

  const tokens = getComputedStyle(el);
  const slickGround = cssRGB(tokens.getPropertyValue('--lcd-ground-bot').trim()).slice(0, 3).map((v) => v * 255);
  const drawSlick = makeSlick($('finale-slick'), slickGround);

  const live = () => { screen.classList.remove('is-live'); void screen.offsetWidth; screen.classList.add('is-live'); };
  const startVideo = () => { if (reduced.matches) { video.pause(); if (video.readyState >= 1) video.currentTime = 2.6; return; } video.play().catch(() => {}); };
  video.src = VIDEO;
  d.on(video, 'loadedmetadata', () => { if (reduced.matches) video.currentTime = 2.6; });
  startVideo(); live();

  const armAuto = () => { clearTimeout(autoT); if (playAt === null && hw && !reduced.matches) autoT = setTimeout(play, DUR.auto); };
  d.add(() => clearTimeout(autoT));
  function play() { if (!hw || playAt !== null) return; clearTimeout(autoT);
    playAt = reduced.matches ? performance.now() - END : performance.now(); idleDrawn = false; playBtn.classList.add('gone'); playBtn.blur?.(); }
  function replay() { if (playAt === null) return; playAt = null; hold = null; idleDrawn = false; t0 = performance.now();
    replayBtn.classList.remove('on'); replayBtn.hidden = true; endLine.classList.remove('on'); playBtn.classList.remove('gone');
    screen.style.visibility = ''; live(); startVideo(); armAuto(); el.focus({ preventScroll: true }); }
  d.on(playBtn, 'click', play);
  d.on(replayBtn, 'click', replay);
  d.on(el, 'keydown', (e) => { if (e.target !== el || (e.key !== ' ' && e.key !== 'Enter')) return; e.preventDefault(); if (playAt === null) play(); else if (!replayBtn.hidden) replay(); });
  d.on(el, 'pointermove', () => { if (playAt === null) armAuto(); });

  /* the screen layer's transform from a display rect in device px; without a GPU, the same rect the camera gives at z = 0 */
  const place = (R, k) => { screen.style.transform = `translate(${R.x * k}px, ${R.y * k}px) scale(${R.w * k / LAYER_W})`; };
  const cssRect = () => { const cw = el.clientWidth, ch = el.clientHeight, w = cw * 1.003, h = w * LAYER_H / LAYER_W; return { x: (cw - w) / 2, y: (ch - h) / 2, w, h }; };
  const fitCanvas = () => { const r = canvas.getBoundingClientRect(); const w = Math.max(2, Math.round(r.width * DPR)), h = Math.max(2, Math.round(r.height * DPR)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; } return false; };

  /* one frame from one time: everything below is a function of (now − t0) and (now − playAt) */
  const frame = (now) => {
    const T = hold !== null ? hold : playAt === null ? -1 : now - playAt;
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
    place(hw.rectAt(z), k);
    /* GPU: once closed and converged, the canvas keeps its last frame and nothing is drawn */
    if (!idleDrawn) {
      const enc = dev.createCommandEncoder();
      const accumulating = hw.body(enc, pose, z, Math.PI - openness * Math.PI, outer, still);
      hw.composite(enc, { rect: hw.rectAt(z), awake, settled: foldP === 0, time: sec, fade: 1, colors });
      dev.queue.submit([enc.finish()]);
      if (!drewOnce) { drewOnce = true; screen.classList.remove('fn-css-ground'); }
      if (T >= END && !accumulating) idleDrawn = true;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  d.add(() => cancelAnimationFrame(raf));

  playBtn.classList.add('gone');
  (async () => {
    try { dev = await getDevice(); } catch (e) { console.info('finale: no WebGPU, credits stay a still screen —', e.message); return; }
    if (gone) { releaseDevice(dev); return; }
    dev.lost.then((info) => { if (gone) return; console.warn('finale: device lost', info.message); hw = null; screen.classList.add('fn-css-ground'); playBtn.classList.add('gone'); });
    colors = { top: cssRGB(tokens.getPropertyValue('--lcd-ground-top').trim()), bot: cssRGB(tokens.getPropertyValue('--lcd-ground-bot').trim()),
      ink: cssRGB(tokens.getPropertyValue('--lcd-ink').trim()), tint: cssRGB(tokens.getPropertyValue('--tint-composite').trim()) };
    ctx = canvas.getContext('webgpu'); ctx.configure({ device: dev, format, alphaMode: 'premultiplied' });
    fitCanvas(); hw = makeHardware(dev, canvas, ctx, format); hw.resize();
    playBtn.classList.remove('gone'); armAuto();
  })();

  /* a verification handle on the element: freeze the timeline at T ms after the trigger (null resumes), or read it */
  canvas.__finale = { play, replay, seek: (ms) => { if (ms !== null && playAt === null) { playAt = performance.now(); playBtn.classList.add('gone'); } hold = ms; idleDrawn = false; clearTimeout(autoT); },
    state: () => ({ ready: !!hw, playAt, hold, END }) };

  return () => {
    gone = true;
    d.run();
    video.pause(); video.removeAttribute('src'); video.load();
    if (hw) { hw.destroy(); hw = null; }
    if (ctx) { try { ctx.unconfigure(); } catch {} }
    releaseDevice(dev);
    delete canvas.__finale;
    root.innerHTML = '';
  };
}
