// @ts-nocheck -- sheet code, untyped on the sheet
import { stage } from '../../_kit/stage.js';
import { disposer } from '../../_kit/disposer.js';
import css from './demo.css?raw';
import html from './demo.html?raw';

/* One table drives the chips, the stage map, the cost readout and the
   specimen. Splitting them would let the diagram claim one thing while
   the animation did another — the single failure this page cannot
   afford, since its whole job is teaching what the stages mean. */
const STAGES = [
  { ix: '01', nm: 'style',     ds: 'resolve which rules apply' },
  { ix: '02', nm: 'layout',    ds: 'compute geometry + position' },
  { ix: '03', nm: 'paint',     ds: 'rasterise pixels into layers' },
  { ix: '04', nm: 'composite', ds: 'assemble layers on the GPU' },
];

const PROPS = [
  { p: 'transform',        runs: [1, 0, 0, 1], why: 'Handed straight to the compositor. The layer is already rasterised on the GPU — moving it costs a matrix multiply, not a repaint.' },
  { p: 'opacity',          runs: [1, 0, 0, 1], why: 'Compositor-only, same as transform. The layer is blended at a different alpha; nothing is re-rasterised.' },
  { p: 'background-color', runs: [1, 0, 1, 1], why: 'Geometry is unchanged, so layout is skipped — but the pixels are wrong now, so the layer must be repainted every frame.' },
  { p: 'box-shadow',       runs: [1, 0, 1, 1], why: 'Repaint only. Cheap in principle, but a large blur radius is one of the most expensive things you can ask the rasteriser to do.' },
  { p: 'width',            runs: [1, 1, 1, 1], why: 'Changes the box model, so every following element may move too. Layout runs on the main thread — the same thread as your JS.' },
  { p: 'left',             runs: [1, 1, 1, 1], why: 'Position is a layout property even when nothing else moves. This is the classic jank source, and the one SL-07 races against transform.' },
];

export function mount(host) {
  const { root } = stage(host, { css, html });
  const d = disposer();
  if (window.top !== window.self) root.getElementById('crumb').style.display = 'none';

  const stagesEl = root.getElementById('plStages');
  const propsEl = root.getElementById('plProps');
  const costEl = root.getElementById('plCost');
  const whyEl = root.getElementById('plWhy');
  const boxEl = root.getElementById('plBox');

  stagesEl.innerHTML = STAGES.map(s => `
    <div class="pl-stage" data-run="1" data-testid="stage-${s.nm}">
      <span class="ix">${s.ix}</span><span class="nm">${s.nm}</span><span class="ds">${s.ds}</span>
      <span class="skip">skipped</span><span class="pulse"></span>
    </div>`).join('');

  propsEl.innerHTML = PROPS.map((d, i) => `
    <button class="pl-prop${i === 0 ? ' is-on' : ''}" data-i="${i}" data-testid="prop-${d.p}">
      <code>${d.p}</code><span class="n">${d.runs.reduce((a, b) => a + b, 0)}/4</span>
    </button>`).join('');

  function select(i) {
    const d = PROPS[i];
    [...propsEl.children].forEach((el, k) => el.classList.toggle('is-on', k === i));
    [...stagesEl.children].forEach((el, k) => { el.dataset.run = d.runs[k]; });

    const n = d.runs.reduce((a, b) => a + b, 0);
    const compositorOnly = !d.runs[1] && !d.runs[2];
    costEl.textContent = `${n} of 4 · ${compositorOnly ? 'compositor thread' : 'main thread, every frame'}`;
    whyEl.textContent = d.why;

    // restart the specimen so the change is visible immediately rather
    // than at the end of the current 1.5s cycle
    boxEl.style.animation = 'none';
    boxEl.removeAttribute('style');
    void boxEl.offsetWidth;
    boxEl.dataset.p = d.p;
  }

  d.on(propsEl, 'click', e => {
    const b = e.target.closest('.pl-prop');
    if (b) select(+b.dataset.i);
  });

  /* the specimen's travel is measured from the track, so the box lands
     inside it at any width rather than at a hardcoded pixel guess */
  function sizeTravel() {
    const track = root.querySelector('.pl-track');
    if (!track) return;
    boxEl.style.setProperty('--travel', Math.max(80, track.clientWidth - 76) + 'px');
  }
  d.observer(new ResizeObserver(sizeTravel)).observe(root.querySelector('.pl-stageview'));
  sizeTravel();
  select(0);

  return () => { d.run(); root.innerHTML = ''; };
}
