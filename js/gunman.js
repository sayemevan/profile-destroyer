// The little cartoon gunslinger. Drawn with plain canvas paths, origin at his feet.

const INK = '#14121c';
const SKIN = '#ffd0a1';
const SHIRT = '#e63946';
const JEANS = '#3a5a99';
const HAT = '#8b5a2b';
const SHOULDER = { x: 2, y: -54 };
const MUZZLE_Y = -1.5;
const MUZZLE_X = { pistol: 54, uzi: 58, shotgun: 72, bazooka: 78 };

export function drawGunman(g, x, y, s, aim, st = {}) {
  const { walk = 0, moving = 0, recoil = 0, flash = 0, gun = 'pistol' } = st;
  const face = Math.cos(aim) < 0 ? -1 : 1;
  const la = face === 1 ? aim : Math.PI - aim; // aim in his own (facing-right) space

  g.save();
  g.translate(x, y);
  g.scale(s * face, s);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  g.fillStyle = 'rgba(0,0,0,.35)';
  g.beginPath(); g.ellipse(0, 2, 24, 6, 0, 0, Math.PI * 2); g.fill();

  const bob = Math.abs(Math.sin(walk)) * 3 * moving;
  g.translate(0, -bob);

  // Legs + boots
  const sw = Math.sin(walk) * 8 * moving;
  for (const [hx, d] of [[-6, sw], [6, -sw]]) {
    limb(g, hx, -30, hx + d, -6, JEANS, 8);
    g.fillStyle = '#5b3a1e';
    g.strokeStyle = INK; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(hx + d + 3, -4, 8, 4.5, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  }

  // Back arm
  limb(g, -9, -55, -13, -37, SHIRT, 7);

  // Body
  g.fillStyle = SHIRT; g.strokeStyle = INK; g.lineWidth = 3;
  rr(g, -14, -63, 28, 36, 9); g.fill(); g.stroke();
  g.fillStyle = INK; g.fillRect(-14, -35, 28, 5);
  g.fillStyle = '#ffd23f'; g.fillRect(-3, -35, 6, 5);

  // Head
  g.fillStyle = SKIN;
  g.beginPath(); g.arc(0, -77, 16, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = INK;
  g.beginPath(); g.arc(5, -79, 2.2, 0, Math.PI * 2); g.arc(11, -79, 2.2, 0, Math.PI * 2); g.fill();
  g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(1, -86); g.lineTo(7, -83.5); g.moveTo(9, -83.5); g.lineTo(15, -86); g.stroke();
  // mustache
  g.beginPath();
  g.moveTo(2, -71); g.quadraticCurveTo(8, -76, 14, -71); g.quadraticCurveTo(8, -73, 2, -71); g.fill(); g.stroke();

  // Hat
  g.fillStyle = HAT; g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-13, -90); g.lineTo(-11, -106); g.quadraticCurveTo(0, -112, 11, -106); g.lineTo(13, -90);
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = INK; g.fillRect(-13, -95, 26, 4);
  g.fillStyle = HAT;
  g.beginPath(); g.ellipse(0, -90, 27, 5.5, 0, 0, Math.PI * 2); g.fill(); g.stroke();

  // Gun arm
  g.save();
  g.translate(SHOULDER.x, SHOULDER.y);
  g.rotate(la);
  g.translate(-recoil * 6, 0);
  limb(g, 0, 0, 18, 0, SHIRT, 8);
  drawGun(g, gun);
  g.fillStyle = SKIN; g.strokeStyle = INK; g.lineWidth = 2.5;
  g.beginPath(); g.arc(22, 2, 5.5, 0, Math.PI * 2); g.fill(); g.stroke();
  if (flash > 0) {
    g.translate((MUZZLE_X[gun] || 54) + 6, MUZZLE_Y);
    g.scale(flash, flash);
    star(g, 16, 7, 9, '#ffd23f');
    star(g, 8, 3.5, 9, '#ffffff');
  }
  g.restore();

  g.restore();
}

// Screen position of the gun's muzzle, so bullets leave from the barrel.
export function muzzlePos(x, y, s, aim, gun = 'pistol') {
  const face = Math.cos(aim) < 0 ? -1 : 1;
  const la = face === 1 ? aim : Math.PI - aim;
  const mx = MUZZLE_X[gun] || 54;
  const vx = Math.cos(la) * mx - Math.sin(la) * MUZZLE_Y;
  const vy = Math.sin(la) * mx + Math.cos(la) * MUZZLE_Y;
  return { x: x + face * s * (SHOULDER.x + vx), y: y + s * (SHOULDER.y + vy) };
}

export function shoulderPos(x, y, s) {
  return { x: x + SHOULDER.x * s, y: y + SHOULDER.y * s };
}

// Gun in arm space: barrel along +x, hand around (22, 2).
export function drawGun(g, gun) {
  g.strokeStyle = INK; g.lineWidth = 2.5;
  const part = (color, x, y, w, h, r = 2) => { g.fillStyle = color; rr(g, x, y, w, h, r); g.fill(); g.stroke(); };
  switch (gun) {
    case 'uzi':
      part('#3d3d47', 28, 2, 6, 16, 1.5);           // magazine
      part('#4a4a55', 15, -7, 28, 11, 2);
      part('#4a4a55', 42, -4, 15, 5, 1.5);
      part('#3d3d47', 19, 2, 7, 10);
      break;
    case 'shotgun':
      part('#8b5a2b', -2, -4, 22, 9, 3);            // stock
      part('#4a4a55', 18, -6, 18, 9, 2);
      part('#4a4a55', 34, -5, 37, 5, 1.5);          // barrel
      part('#a0522d', 40, 0, 18, 6, 2);             // pump
      break;
    case 'bazooka':
      part('#4e7a3a', -12, -9, 82, 15, 5);          // tube
      part('#3b5e2b', 66, -11, 12, 19, 3);          // bell
      part('#3b5e2b', -16, -10, 8, 17, 2);
      part('#ffd23f', 30, -9, 8, 15, 0);            // stripe
      part('#2b2b33', 22, -16, 7, 7, 1.5);          // sight
      part('#2b2b33', 20, 4, 7, 10);                // grip
      break;
    default:
      part('#4a4a55', 17, -6, 22, 9);
      part('#4a4a55', 37, -4.5, 14, 6, 1.5);
      part('#4a4a55', 20, 1, 7, 11);
  }
}

function limb(g, x1, y1, x2, y2, color, w) {
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
  g.strokeStyle = INK; g.lineWidth = w + 5; g.stroke();
  g.strokeStyle = color; g.lineWidth = w; g.stroke();
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function star(g, outer, inner, points, color) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fillStyle = color;
  g.fill();
}
