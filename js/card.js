// Draws the target profile as a social-media-style card onto an offscreen canvas.

export const CW = 340;   // card size in logical units
export const CH = 440;
export const RES = 2;    // backing resolution multiplier
export const AVATAR = { x: CW / 2, y: 122, r: 58 };

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export function renderCard(p) {
  const c = document.createElement('canvas');
  c.width = CW * RES;
  c.height = CH * RES;
  const g = c.getContext('2d');
  g.scale(RES, RES);
  const color = p.service.color;

  roundRect(g, 0, 0, CW, CH, 22);
  g.fillStyle = '#ffffff';
  g.fill();
  g.save();
  g.clip();

  // Banner
  const grad = g.createLinearGradient(0, 0, CW, 130);
  grad.addColorStop(0, color);
  grad.addColorStop(1, mix(color, '#ff5d9e', 0.45));
  g.fillStyle = grad;
  g.fillRect(0, 0, CW, 122);
  g.fillStyle = 'rgba(255,255,255,.12)';
  for (const [x, y, r] of [[40, 30, 46], [290, 90, 70], [190, 10, 24], [120, 110, 30]]) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  // Platform pill
  g.font = `700 12px ${SANS}`;
  const label = p.service.name.toUpperCase();
  const pw = g.measureText(label).width + 20;
  roundRect(g, 14, 14, pw, 24, 12);
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.fill();
  g.fillStyle = color === '#111111' ? '#111' : color;
  g.textBaseline = 'middle';
  g.fillText(label, 24, 26.5);

  // Avatar
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(CW / 2, 122, 64, 0, Math.PI * 2); g.fill();
  g.save();
  g.beginPath(); g.arc(CW / 2, 122, 58, 0, Math.PI * 2); g.clip();
  drawCover(g, p.avatar, CW / 2 - 58, 64, 116, 116);
  g.restore();

  // Name + handle
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#111';
  fitText(g, p.name, CW - 40, 24, 16, 800);
  g.fillText(truncate(g, p.name, CW - 40), CW / 2, 220);
  g.fillStyle = '#6b7280';
  g.font = `500 15px ${SANS}`;
  g.fillText(truncate(g, '@' + p.handle, CW - 40), CW / 2, 243);

  // Bio
  g.fillStyle = '#374151';
  g.font = `400 13.5px ${SANS}`;
  wrap(g, p.bio, CW - 52).slice(0, 3).forEach((line, i) => g.fillText(line, CW / 2, 272 + i * 18));

  // Stats
  g.fillStyle = '#e5e7eb';
  g.fillRect(24, 330, CW - 48, 1);
  p.stats.forEach(([value, name], i) => {
    const x = CW * (1 + i * 2) / 6;
    g.fillStyle = '#111';
    g.font = `800 19px ${SANS}`;
    g.fillText(value, x, 361);
    g.fillStyle = '#6b7280';
    g.font = `500 12px ${SANS}`;
    g.fillText(name, x, 379);
  });

  // Follow button
  roundRect(g, CW / 2 - 90, 396, 180, 30, 15);
  g.fillStyle = color;
  g.fill();
  g.fillStyle = '#fff';
  g.font = `700 14px ${SANS}`;
  g.fillText('Follow', CW / 2, 416);

  g.restore();
  roundRect(g, 1, 1, CW - 2, CH - 2, 21);
  g.strokeStyle = 'rgba(0,0,0,.12)';
  g.lineWidth = 2;
  g.stroke();
  g.setTransform(1, 0, 0, 1, 0, 0); // the game draws on this canvas later with its own scale
  return c;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawCover(g, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s, sh = h / s;
  g.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

function fitText(g, text, maxW, size, min, weight) {
  do { g.font = `${weight} ${size}px ${SANS}`; size--; } while (g.measureText(text).width > maxW && size >= min);
}

function truncate(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text;
  while (text.length > 1 && g.measureText(text + '…').width > maxW) text = text.slice(0, -1);
  return text + '…';
}

function wrap(g, text, maxW) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const test = line ? line + ' ' + word : word;
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > 3) lines[2] = truncate(g, lines[2] + '…', maxW);
  return lines;
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
