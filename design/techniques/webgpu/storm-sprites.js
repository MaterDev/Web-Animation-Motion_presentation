/* SUPERCELL · the things a tornado throws, drawn once into a sprite atlas.
   After the Rock 'em Sock 'em stage's sprite sheet: recognisable silhouettes at a glance,
   chunky, shaded flat, with a dark outline so they read against a dark sky.
   Frames 0–5 are flung debris (cow, tree, barn, hay bale, fence, fish);
   6–8 stand on the horizon (farmhouse, windmill, silo); 9–11 are rooted in the middle
   ground and sway (bush, poplar, utility pole). */
export const SPRITE_PX = 64, SPRITE_FRAMES = 12;
const TAU = Math.PI * 2;

function cow(x) {
  x.fillStyle = '#1b1b1b'; for (const lx of [18, 25, 38, 45]) x.fillRect(lx, 36, 4, 14);
  x.fillStyle = '#f2f0ea'; x.beginPath(); x.ellipse(32, 32, 20, 11, 0, 0, TAU); x.fill();
  x.fillStyle = '#1b1b1b'; x.beginPath(); x.ellipse(26, 28, 6, 4, 0.4, 0, TAU); x.fill(); x.beginPath(); x.ellipse(40, 35, 5, 4, -0.3, 0, TAU); x.fill();
  x.fillStyle = '#f2f0ea'; x.beginPath(); x.ellipse(12, 28, 7, 6, 0, 0, TAU); x.fill();
  x.fillStyle = '#e9a8a8'; x.beginPath(); x.ellipse(8, 31, 4, 3, 0, 0, TAU); x.fill();
  x.fillStyle = '#1b1b1b'; x.fillRect(11, 24, 2, 2);
}
function tree(x) {
  x.fillStyle = '#5a3a22'; x.fillRect(28, 34, 8, 30);
  x.fillStyle = '#2f6b33'; for (const [cx, cy, r] of [[32, 22, 16], [20, 30, 11], [44, 30, 11], [32, 12, 10]]) { x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); }
  x.fillStyle = '#4b8d45'; x.beginPath(); x.arc(27, 17, 6, 0, TAU); x.fill();
}
function barn(x) {
  x.fillStyle = '#a3322a'; x.beginPath(); x.moveTo(8, 56); x.lineTo(8, 28); x.lineTo(32, 10); x.lineTo(56, 28); x.lineTo(56, 56); x.closePath(); x.fill();
  x.fillStyle = '#f0e8dc'; x.fillRect(22, 36, 20, 20); x.fillStyle = '#a3322a'; x.fillRect(25, 39, 14, 17);
  x.strokeStyle = '#f0e8dc'; x.lineWidth = 2; x.beginPath(); x.moveTo(25, 39); x.lineTo(39, 56); x.moveTo(39, 39); x.lineTo(25, 56); x.stroke();
  x.fillStyle = '#f0e8dc'; x.fillRect(28, 20, 8, 7);
}
function hay(x) {
  x.fillStyle = '#d9b44a'; x.beginPath(); x.ellipse(32, 34, 22, 17, 0, 0, TAU); x.fill();
  x.strokeStyle = '#a8842a'; x.lineWidth = 2; for (const r of [6, 11, 16]) { x.beginPath(); x.ellipse(32, 34, r * 1.3, r, 0, 0, TAU); x.stroke(); }
}
function fence(x) {
  x.fillStyle = '#b89a72'; x.fillRect(4, 22, 56, 7); x.fillRect(4, 38, 56, 7);
  x.fillStyle = '#8c6f4c'; for (const px of [8, 30, 52]) x.fillRect(px, 12, 6, 44);
}
function fish(x) {
  x.fillStyle = '#7fa8b8'; x.beginPath(); x.ellipse(28, 32, 18, 9, 0, 0, TAU); x.fill();
  x.beginPath(); x.moveTo(44, 32); x.lineTo(58, 22); x.lineTo(58, 42); x.closePath(); x.fill();
  x.fillStyle = '#1b1b1b'; x.fillRect(16, 29, 3, 3);
}
function farmhouse(x) {
  x.fillStyle = '#e4dccb'; x.fillRect(10, 30, 44, 28);
  x.fillStyle = '#4a4550'; x.beginPath(); x.moveTo(6, 32); x.lineTo(32, 12); x.lineTo(58, 32); x.closePath(); x.fill();
  x.fillStyle = '#f2d77a'; x.fillRect(18, 38, 8, 8); x.fillRect(38, 38, 8, 8);
}
function windmill(x) {
  x.strokeStyle = '#8f8f96'; x.lineWidth = 3; x.beginPath(); x.moveTo(26, 62); x.lineTo(31, 18); x.moveTo(38, 62); x.lineTo(33, 18); x.stroke();
  x.fillStyle = '#b8b8c0'; for (let k = 0; k < 8; k++) { x.save(); x.translate(32, 16); x.rotate(k * TAU / 8); x.fillRect(-2, -14, 4, 12); x.restore(); }
}
function silo(x) {
  x.fillStyle = '#b9bcc2'; x.fillRect(20, 16, 24, 44);
  x.beginPath(); x.arc(32, 16, 12, Math.PI, 0); x.fill();
  x.strokeStyle = '#8d9097'; x.lineWidth = 2; for (const y of [26, 36, 46]) { x.beginPath(); x.moveTo(20, y); x.lineTo(44, y); x.stroke(); }
}
/* the middle ground: things rooted to the plain that bend in the wind; each stands on the frame's bottom edge */
function bush(x) {
  x.fillStyle = '#24452a'; for (const [cx, cy, r] of [[32, 48, 15], [20, 52, 10], [44, 52, 10], [32, 38, 10]]) { x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); }
  x.fillStyle = '#35603a'; x.beginPath(); x.arc(28, 40, 5, 0, TAU); x.fill();
}
function poplar(x) {
  x.fillStyle = '#3d2a1c'; x.fillRect(30, 50, 4, 14);
  x.fillStyle = '#1f3d26'; x.beginPath(); x.ellipse(32, 30, 11, 26, 0, 0, TAU); x.fill();
  x.fillStyle = '#2c5233'; x.beginPath(); x.ellipse(29, 24, 5, 14, 0, 0, TAU); x.fill();
}
function pole(x) {
  x.fillStyle = '#3a2c22'; x.fillRect(30, 4, 4, 60); x.fillRect(16, 10, 32, 3);
  x.fillStyle = '#9aa0a8'; for (const px of [18, 30, 44]) x.fillRect(px, 7, 2, 3);
}
const DRAW = [cow, tree, barn, hay, fence, fish, farmhouse, windmill, silo, bush, poplar, pole];

/* a 12 × 64 px canvas; each frame drawn, then outlined by dilating its alpha in a dark ink */
export function spriteAtlas() {
  const W = SPRITE_PX * SPRITE_FRAMES, H = SPRITE_PX;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  DRAW.forEach((fn, i) => { x.save(); x.translate(i * SPRITE_PX, 0); x.beginPath(); x.rect(0, 0, SPRITE_PX, SPRITE_PX); x.clip(); fn(x); x.restore(); });
  const img = x.getImageData(0, 0, W, H), src = new Uint8ClampedArray(img.data), d = img.data;
  for (let y = 0; y < H; y++) for (let px = 0; px < W; px++) {
    const o = (y * W + px) * 4; if (src[o + 3] > 128) continue;
    let near = false; for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xx = px + dx; if (yy < 0 || yy >= H || xx < 0 || xx >= W || Math.floor(xx / SPRITE_PX) !== Math.floor(px / SPRITE_PX)) continue; if (src[(yy * W + xx) * 4 + 3] > 128) { near = true; break; } }
    if (near) { d[o] = 11; d[o + 1] = 8; d[o + 2] = 26; d[o + 3] = 255; }
  }
  x.putImageData(img, 0, 0);
  return c;
}
