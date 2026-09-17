// @ts-nocheck -- copied from the shared helpers of design/techniques/canvas.html (lines 861–942); untyped sheet code
/* The sheet's shared instruments, as this demo's own copy.
   Changes from the sheet: `root` reads the demo's host (where the shadow
   root's :host tokens land) instead of document.documentElement, and the
   world probe is appended inside the shadow root rather than document.body,
   so world-scoped tokens resolve. Everything else is verbatim. */

export var TAU = Math.PI * 2;

/* The named sync point. Chrome records 2D commands and rasterises them
   later, so a bracket that ends without one measures how fast commands were
   SUBMITTED. getImageData forces every queued command to resolve. Called
   alone it costs ~0 ms — measured below and printed — so whatever it adds
   to a bracket is work that had simply not happened yet when the clock
   stopped. */
export function sync(ctx) { ctx.getImageData(0, 0, 1, 1); }

/* performance.now() is not the same clock in every engine: roughly 100 µs in
   Chromium, clamped to 1 ms in Firefox and WebKit as an anti-fingerprinting
   measure. Bounded by wall time rather than iteration count, because under a
   1 ms clamp "sample 40 000 times" is forty seconds of blocked main thread. */
export var CLOCK_FLOOR = (function () {
  var min = Infinity, deadline = performance.now() + 4, a, b;
  while (performance.now() < deadline) {
    a = performance.now(); b = performance.now();
    if (b > a && b - a < min) min = b - a;
  }
  return min === Infinity ? 1 : min;
})();

export function median(a) {
  var s = a.slice().sort(function (x, y) { return x - y; });
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}
/* A figure within five floors of the clock's resolution is a bound, not a
   value, and gets said so rather than printed as though it were measured. */
export function atFloor(ms) { return ms < CLOCK_FLOOR * 5 ? '<span class="cv-dagger">†</span>' : ''; }
export function ms(v) { return v < 10 ? v.toFixed(2) : v.toFixed(1); }

/* xorshift32. Math.random() cannot be used anywhere a picture has to be
   reproduced: Table A's whole claim is that four methods drew the SAME
   marks, and that is only checkable if the coordinates repeat exactly. */
export function rng(seed) {
  var s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* One ink, resolved from the token, parsed once. Every method draws in this
   array — including putImageData, which is where a hardcoded triple would
   otherwise sit and silently stop tracking the token. */
export function resolveRGB(cssColour) {
  var c = document.createElement('canvas'); c.width = c.height = 1;
  var x = c.getContext('2d');
  x.fillStyle = cssColour; x.fillRect(0, 0, 1, 1);
  var d = x.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

/* Each world declares its palette on its own class, not on :root, so one
   probe has to wear the world's class or a lookup silently returns '' and
   the demo draws a fallback colour while claiming to draw the token.
   `host` carries the design tokens (:host), `parent` is where the probe
   lives — inside the shadow root, or the world's class would not match. */
export function createTokens(host, parent, classes) {
  var root = getComputedStyle(host);
  var worldProbe = document.createElement('div');
  worldProbe.className = classes;
  worldProbe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none';
  parent.appendChild(worldProbe);
  var worldRoot = getComputedStyle(worldProbe);
  var TOKEN_MISSES = [];
  function token(name) {
    var v = root.getPropertyValue(name).trim() || worldRoot.getPropertyValue(name).trim();
    if (!v) TOKEN_MISSES.push(name);
    return v;
  }
  /* The sheet printed misses on its page-level instrument plate, which the
     demo does not carry; a miss is reported to the console instead. */
  function reportTokenMisses() {
    if (!TOKEN_MISSES.length) return;
    var uniq = TOKEN_MISSES.filter(function (v, i, a) { return a.indexOf(v) === i; });
    console.warn(uniq.length + ' token(s) did not resolve: ' + uniq.join(', ') +
      ' — every colour drawn from them is a fallback, not the design system.');
  }
  return { token: token, TOKEN_MISSES: TOKEN_MISSES, reportTokenMisses: reportTokenMisses, dispose: function () { worldProbe.remove(); } };
}
