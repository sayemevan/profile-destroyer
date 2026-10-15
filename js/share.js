// Builds the brag image (1080×1080) and the share links.

import { CW, CH } from './card.js';
import { drawGunman } from './gunman.js';
import { BRAND } from './brand.js';
import { targetLabel } from './targets.js';

const S = 1080;
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const DISPLAY = 'Bungee, Impact, "Arial Black", sans-serif';

export async function makeShareImage({ dmg, original, pct, profile, weapon }) {
  try { await document.fonts.load('60px Bungee'); } catch { /* fallback font is fine */ }
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');

  const bg = g.createRadialGradient(S / 2, 460, 40, S / 2, 540, 800);
  bg.addColorStop(0, '#5a40a0');
  bg.addColorStop(1, '#221a40');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);

  // comic burst rays behind the AFTER card
  g.save();
  g.translate(800, 480);
  g.fillStyle = 'rgba(255,210,63,.07)';
  for (let i = 0; i < 18; i++) {
    g.rotate(Math.PI / 9);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-60, -900); g.lineTo(60, -900); g.closePath(); g.fill();
  }
  g.restore();

  // halftone dots
  g.fillStyle = 'rgba(255,255,255,.05)';
  for (let y = 0; y < S; y += 30) for (let x = (y / 30) % 2 ? 15 : 0; x < S; x += 30) {
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
  }

  // title
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = `56px ${DISPLAY}`;
  g.fillStyle = '#000';
  g.fillText('PROFILE DESTROYER', S / 2 + 5, 89);
  g.fillStyle = '#ffd23f';
  g.fillText('PROFILE DESTROYER', S / 2, 84);

  // before / after cards
  const cw = 450, ch = cw * CH / CW, cy = 182 + ch / 2;
  card(g, original, 275, cy, cw, ch, 0.035);
  card(g, dmg, 805, cy, cw, ch, -0.04);
  pill(g, 'BEFORE', 275, 150, '#2ecc71', '#06240f');
  pill(g, 'AFTER', 805, 150, '#ff3b3b', '#fff');

  // arrow between them
  g.save();
  g.translate(540, cy);
  g.fillStyle = '#ffd23f';
  g.strokeStyle = '#000';
  g.lineWidth = 6;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(-30, -14); g.lineTo(4, -14); g.lineTo(4, -32); g.lineTo(36, 0);
  g.lineTo(4, 32); g.lineTo(4, 14); g.lineTo(-30, 14); g.closePath();
  g.fill(); g.stroke();
  g.restore();

  // stamp
  const stamp = `${pct}% DESTROYED`;
  g.save();
  g.translate(S / 2, 850);
  g.rotate(-0.05);
  let size = 92;
  do { g.font = `${size}px ${DISPLAY}`; size -= 2; } while (g.measureText(stamp).width > 860);
  g.lineJoin = 'round';
  g.lineWidth = 16;
  g.strokeStyle = '#000';
  g.strokeText(stamp, 6, 6);
  g.strokeText(stamp, 0, 0);
  g.fillStyle = '#ff3b3b';
  g.fillText(stamp, 0, 0);
  g.restore();

  // subline + footer
  const line = `I blasted ${targetLabel(profile)} with a ${weapon.name.toLowerCase()}`;
  g.fillStyle = '#ffffff';
  fit(g, line, 780, 34, 22, 700);
  g.fillText(line, S / 2 + 50, 925);
  g.fillStyle = '#d9d0f2';
  g.font = `600 26px ${SANS}`;
  g.fillText(`Your turn → ${location.host}`, S / 2 + 50, 968);
  brandBar(g, S / 2 + 55, 1030);

  drawGunman(g, 95, 1062, 1.45, -0.95, { flash: 1, gun: weapon.id });
  return c;
}

// "Follow  [f] fb.com/sayemdreams   [▶] @SayemDreams"
function brandBar(g, cx, cy) {
  const fb = BRAND.facebookShort, yt = BRAND.youtubeHandle;
  g.save();
  g.font = `700 27px ${SANS}`;
  const label = 'Follow';
  const wl = g.measureText(label).width, wf = g.measureText(fb).width, wy = g.measureText(yt).width;
  const icon = 34, gap = 10, sep = 30;
  const w = 28 + wl + sep + icon + gap + wf + sep + icon + gap + wy + 28;
  let x = cx - w / 2;
  g.fillStyle = '#ffd23f';
  g.strokeStyle = '#000';
  g.lineWidth = 4;
  g.beginPath(); g.roundRect(x, cy - 30, w, 60, 30); g.fill(); g.stroke();
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = '#111';
  x += 28;
  g.fillText(label, x, cy + 1); x += wl + sep;
  // Facebook "f"
  g.fillStyle = '#1877f2';
  g.beginPath(); g.arc(x + icon / 2, cy, icon / 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  g.font = `900 26px ${SANS}`;
  g.textAlign = 'center';
  g.fillText('f', x + icon / 2 + 1, cy + 3);
  g.textAlign = 'left';
  g.font = `700 27px ${SANS}`;
  x += icon + gap;
  g.fillStyle = '#111';
  g.fillText(fb, x, cy + 1); x += wf + sep;
  // YouTube play button
  g.fillStyle = '#ff0000';
  g.beginPath(); g.roundRect(x, cy - 12, icon, 24, 7); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(x + 13, cy - 6); g.lineTo(x + 23, cy); g.lineTo(x + 13, cy + 6); g.closePath(); g.fill();
  x += icon + gap;
  g.fillStyle = '#111';
  g.fillText(yt, x, cy + 1);
  g.restore();
}

function card(g, img, x, y, w, h, rot) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.shadowColor = 'rgba(0,0,0,.6)';
  g.shadowBlur = 36;
  g.shadowOffsetY = 14;
  g.drawImage(img, -w / 2, -h / 2, w, h);
  g.restore();
}

function pill(g, text, x, y, bg, fg) {
  g.save();
  g.font = `30px ${DISPLAY}`;
  const w = g.measureText(text).width + 40;
  g.translate(x, y);
  g.rotate(-0.04);
  g.fillStyle = bg;
  g.strokeStyle = '#000';
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(-w / 2, -24, w, 48, 24);
  g.fill(); g.stroke();
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 0, 2);
  g.restore();
}

export function shareLink(profile, pct) {
  const base = location.origin + location.pathname;
  if (!profile.url) return base;
  // A private profile's name (typed by the player) rides along so friends see it too.
  const name = profile.private && profile.name !== 'Mystery User' ? `&n=${encodeURIComponent(profile.name)}` : '';
  return `${base}?t=${encodeURIComponent(profile.url)}&s=${pct}${name}`;
}

export function shareText(profile, pct, weapon) {
  const who = targetLabel(profile);
  const gun = weapon ? ` with a ${weapon.name.toLowerCase()}` : '';
  return `💥🔫 I destroyed ${pct}% of ${who}${gun} on Profile Destroyer. Can you beat that?`;
}

export function socialUrls(text, link) {
  const u = encodeURIComponent(link);
  return {
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${u}`,
    // Opens Facebook directly; the before/after image shows as the link preview (og:image).
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}&hashtag=${encodeURIComponent(BRAND.hashtag)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`,
  };
}

function fit(g, text, maxW, size, min, weight) {
  do { g.font = `${weight} ${size}px ${SANS}`; size--; } while (g.measureText(text).width > maxW && size >= min);
}
