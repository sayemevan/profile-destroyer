// Builds the brag image (1080×1080) and the share links.

import { CW, CH } from './card.js';
import { drawGunman } from './gunman.js';

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
  const who = profile.url ? `@${profile.handle}'s ${profile.service.name} profile` : 'this profile';
  const line = `I blasted ${who} with a ${weapon.name.toLowerCase()}`;
  g.fillStyle = '#ffffff';
  fit(g, line, 780, 34, 22, 700);
  g.fillText(line, S / 2 + 50, 935);
  g.fillStyle = '#b3a8cf';
  g.font = `600 28px ${SANS}`;
  g.fillText(`Your turn → ${location.host}`, S / 2 + 50, 992);

  drawGunman(g, 95, 1062, 1.45, -0.95, { flash: 1, gun: weapon.id });
  return c;
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
  return `${base}?t=${encodeURIComponent(profile.url)}&s=${pct}`;
}

export function shareText(profile, pct, weapon) {
  const who = profile.url ? `@${profile.handle}'s ${profile.service.name} profile` : 'this profile';
  const gun = weapon ? ` with a ${weapon.name.toLowerCase()}` : '';
  return `💥🔫 I destroyed ${pct}% of ${who}${gun} on Profile Destroyer. Can you beat that?`;
}

export function socialUrls(text, link) {
  const t = encodeURIComponent(text), u = encodeURIComponent(link);
  return {
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}`,
  };
}

function fit(g, text, maxW, size, min, weight) {
  do { g.font = `${weight} ${size}px ${SANS}`; size--; } while (g.measureText(text).width > maxW && size >= min);
}
