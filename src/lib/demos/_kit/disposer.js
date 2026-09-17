/* Everything a demo starts, it registers here, and one call stops it.
   A slide that unmounts must leave no listener, timer, frame, observer,
   media stream, worker or GPU resource behind. */
export function disposer() {
  /** @type {(() => void)[]} */
  const fns = [];
  const add = (/** @type {() => void} */ fn) => { fns.push(fn); return fn; };
  return {
    add,
    /** @param {EventTarget} target @param {string} type @param {EventListenerOrEventListenerObject} fn @param {AddEventListenerOptions | boolean} [opts] */
    on(target, type, fn, opts) { target.addEventListener(type, fn, opts); add(() => target.removeEventListener(type, fn, opts)); },
    /** @param {() => void} fn @param {number} ms */
    interval(fn, ms) { const id = setInterval(fn, ms); add(() => clearInterval(id)); return id; },
    /** @param {() => void} fn @param {number} ms */
    timeout(fn, ms) { const id = setTimeout(fn, ms); add(() => clearTimeout(id)); return id; },
    /** @param {{ disconnect(): void }} obs */
    observer(obs) { add(() => obs.disconnect()); return obs; },
    run() { while (fns.length) { try { /** @type {() => void} */ (fns.pop())(); } catch { /* already gone */ } } },
  };
}
