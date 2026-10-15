// The shooting round: gunman at the bottom, profile card up top, bullets punch
// holes and knock chunks off. Destruction % is tracked on a coarse cell grid.

import { sfx } from './audio.js';
import { drawGunman, muzzlePos, shoulderPos } from './gunman.js';
import { renderCard, CW, CH, RES, AVATAR } from './card.js';
import { WEAPONS } from './weapons.js';

const CELL = 10;
const COLS = Math.ceil(CW / CELL);
const ROWS = Math.ceil(CH / CELL);
const TOTAL = COLS * ROWS;
const ROUND = 15;          // seconds per round
const TAU = Math.PI * 2;
const POWS = ['POW!', 'BAM!', 'BLAM!', 'KAPOW!', 'BOOM!', 'WHAM!'];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  constructor(canvas, ui) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.ui = ui;
    this.pointer = { down: false, active: false, x: 0, y: 0 };
    this.running = false;
    this.weapon = WEAPONS.pistol;
    this.loop = this.loop.bind(this);
    this.bindInput();
    window.addEventListener('resize', () => this.running && this.layout());
  }

  bindInput() {
    const c = this.c, p = this.pointer;
    const pos = e => {
      const r = c.getBoundingClientRect();
      p.x = e.clientX - r.left;
      p.y = e.clientY - r.top;
      p.active = true;
    };
    c.addEventListener('pointerdown', e => {
      e.preventDefault();
      c.setPointerCapture?.(e.pointerId);
      pos(e);
      p.down = true;
      if (this.state === 'play' && this.cool <= 0) { this.fire(); this.cool = this.weapon.gap; }
      this.ui.hint.classList.add('gone');
    });
    c.addEventListener('pointermove', pos);
    const up = () => { p.down = false; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
  }

  start(profile) {
    this.profile = profile;
    this.original = renderCard(profile);
    this.dmg = renderCard(profile);
    this.dctx = this.dmg.getContext('2d', { willReadFrequently: true });
    this.cells = new Uint8Array(TOTAL);
    this.destroyed = 0;
    this.bullets = [];
    this.parts = [];
    this.chunks = [];
    this.texts = [];
    this.combo = 0;
    this.comboT = 0;
    this.bestCombo = 0;
    this.shake = 0;
    this.tilt = 0;
    this.tiltV = 0;
    this.time = ROUND;
    this.cool = 0;
    this.hits = 0;
    this.shots = 0;
    this.T = 0;
    this.pointer.down = false;
    this.pointer.active = false;
    this.layout();
    this.man = { x: this.W / 2, aim: -Math.PI / 2, walk: 0, moving: 0, recoil: 0, flash: 0 };

    this.state = 'count';
    this.countT = 3.999;
    this.lastCount = 4;
    this.ui.hint.classList.remove('gone');
    this.ui.timer.textContent = ROUND;
    this.ui.timer.classList.remove('hurry');
    this.setPct();
    this.setCombo();

    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  setWeapon(id) {
    this.weapon = WEAPONS[id] || WEAPONS.pistol;
    this.cool = Math.min(this.cool || 0, 0.15);
  }

  stop() {
    this.running = false;
    this.ui.countdown.textContent = '';
  }

  layout() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.W = this.c.clientWidth;
    this.H = this.c.clientHeight;
    this.c.width = Math.round(this.W * dpr);
    this.c.height = Math.round(this.H * dpr);
    this.dpr = dpr;
    this.ms = clamp(this.H / 760, 0.8, 1.25);             // gunman scale
    this.groundY = this.H - Math.max(26, this.H * 0.05);
    const top = 128;
    const room = this.groundY - 125 * this.ms - top - 20;
    this.scale = Math.min((this.W - 40) / CW, room / CH, 1.35);
    this.cardCX = this.W / 2;
    this.cardCY = top + (CH * this.scale) / 2;
    const bg = this.g.createRadialGradient(this.W / 2, this.H * 0.3, 10, this.W / 2, this.H * 0.4, Math.max(this.W, this.H));
    bg.addColorStop(0, '#5a40a0');
    bg.addColorStop(1, '#251a45');
    this.bg = bg;
  }

  get angle() {
    return this.tilt + (this.destroyed / TOTAL) * 0.09;
  }

  toCard(x, y) {
    const a = -this.angle;
    const dx = x - this.cardCX, dy = y - this.cardCY;
    return {
      x: (dx * Math.cos(a) - dy * Math.sin(a)) / this.scale + CW / 2,
      y: (dx * Math.sin(a) + dy * Math.cos(a)) / this.scale + CH / 2,
    };
  }

  toScreen(lx, ly) {
    const a = this.angle;
    const dx = (lx - CW / 2) * this.scale, dy = (ly - CH / 2) * this.scale;
    return {
      x: this.cardCX + dx * Math.cos(a) - dy * Math.sin(a),
      y: this.cardCY + dx * Math.sin(a) + dy * Math.cos(a),
    };
  }

  aimPoint() {
    return this.pointer.active ? this.pointer : { x: this.cardCX, y: this.cardCY };
  }

  // ---------------------------------------------------------------- loop

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    this.T += dt;
    const m = this.man, p = this.pointer;

    // Gunman slides under your finger and aims at it.
    if (p.active) {
      const tx = clamp(p.x, 34, this.W - 34);
      const dx = tx - m.x;
      m.x += dx * Math.min(1, dt * 9);
      m.moving = Math.min(1, Math.abs(dx) / 25);
    } else {
      m.moving *= 0.9;
    }
    m.walk += dt * 16 * m.moving;
    const sh = shoulderPos(m.x, this.groundY, this.ms);
    const t = this.aimPoint();
    let a = Math.atan2(t.y - sh.y, t.x - sh.x);
    if (a > -0.12) a = a > Math.PI / 2 ? -Math.PI + 0.12 : -0.12;
    m.aim = a;
    m.recoil = Math.max(0, m.recoil - dt * 9);
    m.flash = Math.max(0, m.flash - dt * 14);

    if (this.state === 'count') {
      this.countT -= dt;
      const n = Math.ceil(this.countT);
      if (n !== this.lastCount) {
        this.lastCount = n;
        if (n > 0) { this.flashText(String(n)); sfx.tick(); }
        else { this.flashText('DESTROY!'); sfx.go(); this.state = 'play'; setTimeout(() => this.state === 'play' && (this.ui.countdown.textContent = ''), 600); }
      }
    } else if (this.state === 'play') {
      const before = Math.ceil(this.time);
      this.time -= dt;
      const secs = Math.max(0, Math.ceil(this.time));
      if (secs !== before) {
        this.ui.timer.textContent = secs;
        if (secs <= 5 && secs > 0) { this.ui.timer.classList.add('hurry'); sfx.tick(); }
      }
      this.cool = Math.max(0, this.cool - dt);
      if (p.down && this.cool <= 0) { this.fire(); this.cool = this.weapon.gap; }
      if (this.time <= 0) this.finish(false);
      else if (this.destroyed / TOTAL >= 0.995) this.finish(true);
    } else if (this.state === 'end') {
      this.endT -= dt;
      if (this.endT <= 0) {
        this.running = false;
        this.ui.countdown.textContent = '';
        this.ui.onEnd(this.result());
        return;
      }
    }

    if (this.combo && (this.comboT -= dt) <= 0) { this.combo = 0; this.setCombo(); }

    // Bullets
    for (const b of this.bullets) {
      b.px = b.x; b.py = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.d += b.speed * dt;
      if (b.rocket && Math.random() < 0.8) this.smoke(b.x, b.y, 10, 0.5);
      if (!b.checked && b.d >= b.dist) { b.checked = true; this.impact(b); }
    }
    this.bullets = this.bullets.filter(b => !b.dead && b.y > -50 && b.x > -50 && b.x < this.W + 50);

    // Particles
    for (const q of this.parts) {
      q.life -= dt;
      q.vy += q.g * dt;
      q.vx *= q.drag; q.vy *= q.drag;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.rot += q.vr * dt;
      if (q.floor && q.y > this.groundY) { q.y = this.groundY; q.vy *= -0.35; q.vx *= 0.6; }
    }
    this.parts = this.parts.filter(q => q.life > 0);

    // Falling chunks
    for (const k of this.chunks) {
      k.vy += 1400 * dt;
      k.x += k.vx * dt; k.y += k.vy * dt;
      k.rot += k.vr * dt;
    }
    this.chunks = this.chunks.filter(k => k.y < this.H + 200);

    for (const s of this.texts) { s.life -= dt; s.y -= 40 * dt; }
    this.texts = this.texts.filter(s => s.life > 0);

    // Card wobble (spring) and screen shake
    this.tiltV += (-this.tilt * 140 - this.tiltV * 7) * dt;
    this.tilt += this.tiltV * dt;
    this.shake = Math.max(0, this.shake - dt * 45);
  }

  // ---------------------------------------------------------------- shooting

  fire() {
    const m = this.man, w = this.weapon;
    const mz = muzzlePos(m.x, this.groundY, this.ms, m.aim, w.id);
    const t = this.aimPoint();
    const base = Math.atan2(t.y - mz.y, t.x - mz.x);
    const dist = Math.hypot(t.x - mz.x, t.y - mz.y);
    for (let i = 0; i < w.pellets; i++) {
      const a = base + rand(-w.spread, w.spread);
      const d = dist * (w.pellets > 1 ? rand(0.95, 1.05) : 1);
      this.bullets.push({
        x: mz.x, y: mz.y, px: mz.x, py: mz.y,
        vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, speed: w.speed,
        d: 0, dist: d, tx: mz.x + Math.cos(a) * d, ty: mz.y + Math.sin(a) * d,
        w, rocket: !!w.rocket,
      });
    }
    m.recoil = w.kick;
    m.flash = w.flash;
    this.shake = Math.min(18, this.shake + w.kick * 1.5);
    this.shots++;
    sfx.shot(w.id);
    navigator.vibrate?.(w.rocket ? 25 : 8);
    if (w.rocket) { for (let i = 0; i < 6; i++) this.smoke(mz.x, mz.y, 14, 0.7); return; }
    // ejected shells
    const face = Math.cos(m.aim) < 0 ? -1 : 1;
    this.parts.push({
      x: m.x + face * 20 * this.ms, y: this.groundY - 58 * this.ms,
      vx: -face * rand(80, 160), vy: rand(-320, -220), g: 1300, drag: 1,
      life: 1.2, max: 1.2, size: 3, color: w.id === 'shotgun' ? '#d63b2f' : '#e0b04a',
      rot: 0, vr: rand(-20, 20), kind: 'shell', floor: true,
    });
  }

  smoke(x, y, size, life) {
    this.parts.push({
      x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-25, 25), vy: rand(-40, -10), g: 0, drag: 0.97,
      life, max: life, size, color: 'rgba(200,200,210,', rot: 0, vr: 0, kind: 'smoke',
    });
  }

  impact(b) {
    const l = this.toCard(b.tx, b.ty);
    const near = this.nearestIntact(l.x, l.y, b.w.reach);
    if (!near) {
      // Flew through empty space / an existing hole.
      // A stray shotgun pellet shouldn't kill the combo.
      if (this.combo && b.w.pellets === 1) { this.combo = 0; this.setCombo(); }
      return;
    }
    b.dead = true;
    const s = near.exact ? { x: b.tx, y: b.ty } : this.toScreen(near.x, near.y);
    this.hit(near.x, near.y, s.x, s.y, b.w);
  }

  // The intact spot closest to (x, y) within `reach`, so near-misses at hole edges still bite.
  nearestIntact(x, y, reach) {
    const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL);
    if (ci >= 0 && cj >= 0 && ci < COLS && cj < ROWS && !this.cells[cj * COLS + ci]) return { x, y, exact: true };
    const span = Math.ceil(reach / CELL);
    let best = null, bestD = reach * reach;
    for (let j = cj - span; j <= cj + span; j++) {
      for (let i = ci - span; i <= ci + span; i++) {
        if (i < 0 || j < 0 || i >= COLS || j >= ROWS || this.cells[j * COLS + i]) continue;
        const mx = (i + 0.5) * CELL, my = (j + 0.5) * CELL;
        const d = (mx - x) ** 2 + (my - y) ** 2;
        if (d <= bestD) { bestD = d; best = { x: mx, y: my, exact: false }; }
      }
    }
    return best;
  }

  hit(lx, ly, sx, sy, w = this.weapon) {
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboT = 1.3;
    this.hits++;
    const mega = this.combo % 10 === 0;
    const big = mega || !!w.rocket;
    const r = mega ? Math.max(24, w.r[1] * 1.4) : rand(w.r[0], w.r[1]);
    const color = this.sample(lx, ly);

    this.punch(lx, ly, r, big);
    this.mark(lx, ly, r);
    if (mega || Math.random() < w.chunkP) {
      const [c0, c1] = w.chunk;
      this.breakChunk(lx + rand(-10, 10), ly + rand(-10, 10), mega ? rand(c1 * 1.4, c1 * 1.7) : rand(c0, c1));
    }

    const n = big ? 40 : w.pellets > 1 ? 5 : 12;
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: sx, y: sy, vx: rand(-260, 260) * (big ? 1.6 : 1), vy: rand(-420, -40), g: 1200, drag: 0.99,
        life: rand(0.5, 1.1), max: 1.1, size: rand(2, 5.5), color: Math.random() < 0.7 ? color : '#ffffff',
        rot: rand(0, TAU), vr: rand(-12, 12), kind: 'debris', floor: true,
      });
    }
    for (let i = 0; i < 7; i++) {
      const a = rand(0, TAU), v = rand(200, 520);
      this.parts.push({
        x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, drag: 0.9,
        life: rand(0.12, 0.25), max: 0.25, size: 2, color: '#ffd23f', rot: 0, vr: 0, kind: 'spark',
      });
    }
    this.parts.push({
      x: sx, y: sy, vx: rand(-20, 20), vy: -30, g: 0, drag: 0.97,
      life: 0.6, max: 0.6, size: big ? 46 : 18, color: 'rgba(40,30,30,', rot: 0, vr: 0, kind: 'smoke',
    });

    this.shake = Math.min(18, this.shake + (big ? 14 : 3.5));
    this.tiltV += rand(-1, 1) * (big ? 3 : 0.7);

    if (big) {
      sfx.big();
      navigator.vibrate?.(40);
      this.pop(mega ? 'MEGA SHOT!' : 'KABOOM!', sx, sy, '#ff3b3b', 30);
    } else {
      sfx.hit();
      if (Math.random() < 0.14) this.pop(POWS[Math.floor(Math.random() * POWS.length)], sx, sy, '#ffd23f', 22);
    }
    this.setCombo();
    this.setPct();
  }

  sample(lx, ly) {
    try {
      const d = this.dctx.getImageData(Math.floor(lx * RES), Math.floor(ly * RES), 1, 1).data;
      return d[3] < 20 ? '#dddddd' : `rgb(${d[0]},${d[1]},${d[2]})`;
    } catch { return '#dddddd'; }
  }

  punch(x, y, r, big) {
    const g = this.dctx;
    g.save();
    g.scale(RES, RES);

    // scorch + cracks only paint on what's left of the card
    g.globalCompositeOperation = 'source-atop';
    const rg = g.createRadialGradient(x, y, r * 0.5, x, y, r * 2.3);
    rg.addColorStop(0, 'rgba(25,12,0,.8)');
    rg.addColorStop(1, 'rgba(25,12,0,0)');
    g.fillStyle = rg;
    g.beginPath(); g.arc(x, y, r * 2.3, 0, TAU); g.fill();

    g.strokeStyle = 'rgba(0,0,0,.6)';
    g.lineWidth = big ? 2 : 1.2;
    const cracks = big ? 9 : Math.floor(rand(3, 6));
    for (let i = 0; i < cracks; i++) {
      let a = rand(0, TAU), cx = x, cy = y;
      const len = r * rand(1.6, big ? 4.5 : 3.4);
      g.beginPath(); g.moveTo(cx, cy);
      for (let s = 0; s < 4; s++) {
        a += rand(-0.5, 0.5);
        cx += Math.cos(a) * len / 4; cy += Math.sin(a) * len / 4;
        g.lineTo(cx, cy);
      }
      g.stroke();
    }

    g.restore();
    this.erase(jaggedPath(x, y, r, 12, 0.65));
  }

  breakChunk(cx, cy, R) {
    const pts = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.2, 0.2);
      const rr = R * rand(0.6, 1.05);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    const size = Math.ceil(R * 2.2);
    const spr = document.createElement('canvas');
    spr.width = spr.height = size * RES;
    const sg = spr.getContext('2d');
    sg.scale(RES, RES);
    sg.translate(size / 2 - cx, size / 2 - cy);
    const shape = polyPath(pts);
    sg.clip(shape);
    sg.drawImage(this.dmg, 0, 0, CW, CH);
    sg.strokeStyle = 'rgba(0,0,0,.45)';
    sg.lineWidth = 2;
    sg.stroke(shape);
    this.erase(shape);
    this.mark(cx, cy, R * 0.85);

    const s = this.toScreen(cx, cy);
    this.chunks.push({
      img: spr, x: s.x, y: s.y, size: size * this.scale,
      vx: rand(-160, 160), vy: rand(-320, -100), rot: this.angle, vr: rand(-7, 7),
    });
  }

  // Cut a shape out of the card. Inside the profile photo, a faded copy of the
  // face stays behind so you can still tell whose profile got wrecked.
  erase(path) {
    const g = this.dctx;
    g.save();
    g.scale(RES, RES);
    g.globalCompositeOperation = 'destination-out';
    g.fill(path);
    g.globalCompositeOperation = 'source-over';
    g.beginPath();
    g.arc(AVATAR.x, AVATAR.y, AVATAR.r, 0, TAU);
    g.clip();
    g.clip(path);
    g.globalAlpha = 0.45;
    g.drawImage(this.original, 0, 0, CW, CH);
    g.restore();
  }

  mark(cx, cy, r) {
    const c0 = Math.max(0, Math.floor((cx - r) / CELL)), c1 = Math.min(COLS - 1, Math.floor((cx + r) / CELL));
    const r0 = Math.max(0, Math.floor((cy - r) / CELL)), r1 = Math.min(ROWS - 1, Math.floor((cy + r) / CELL));
    for (let j = r0; j <= r1; j++) {
      for (let i = c0; i <= c1; i++) {
        const mx = (i + 0.5) * CELL - cx, my = (j + 0.5) * CELL - cy;
        if (mx * mx + my * my <= r * r) {
          const k = j * COLS + i;
          if (!this.cells[k]) { this.cells[k] = 1; this.destroyed++; }
        }
      }
    }
  }

  finish(total) {
    this.state = 'end';
    this.endT = 1.6;
    this.pointer.down = false;
    this.ui.timer.classList.remove('hurry');
    this.flashText(total ? 'TOTALLY DESTROYED!' : 'TIME!');
    sfx.end();
  }

  result() {
    return {
      pct: this.percent(),
      dmg: this.dmg,
      profile: this.profile,
      hits: this.hits,
      shots: this.shots,
      bestCombo: this.bestCombo,
      original: this.original,
      weapon: this.weapon,
    };
  }

  percent() {
    if (!this.destroyed) return 0;
    return clamp(Math.round((this.destroyed / TOTAL) * 100), 1, 100);
  }

  // ---------------------------------------------------------------- UI bits

  setPct() {
    const v = this.percent();
    this.ui.pct.textContent = v + '%';
    this.ui.bar.style.width = v + '%';
  }

  setCombo() {
    const el = this.ui.combo;
    if (this.combo >= 3) {
      el.textContent = `${this.combo} HIT COMBO` + (this.combo % 10 >= 7 ? ' · MEGA SOON' : '');
      el.classList.add('show');
    } else {
      el.classList.remove('show');
    }
  }

  flashText(text) {
    const el = this.ui.countdown;
    el.textContent = text;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  pop(text, x, y, color, size) {
    this.texts.push({ text, x, y, color, size, life: 0.8, rot: rand(-0.3, 0.3) });
  }

  // ---------------------------------------------------------------- render

  draw() {
    const g = this.g, W = this.W, H = this.H;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = this.bg;
    g.fillRect(0, 0, W, H);

    // floor
    g.fillStyle = '#2e2252';
    g.fillRect(0, this.groundY, W, H - this.groundY);
    g.fillStyle = '#6a55a8';
    g.fillRect(0, this.groundY, W, 3);

    g.save();
    g.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);

    // card
    g.save();
    g.translate(this.cardCX, this.cardCY);
    g.rotate(this.angle);
    g.scale(this.scale, this.scale);
    g.shadowColor = 'rgba(0,0,0,.5)';
    g.shadowBlur = 24;
    g.shadowOffsetY = 10;
    g.drawImage(this.dmg, -CW / 2, -CH / 2, CW, CH);
    g.restore();

    for (const k of this.chunks) {
      g.save();
      g.translate(k.x, k.y);
      g.rotate(k.rot);
      g.drawImage(k.img, -k.size / 2, -k.size / 2, k.size, k.size);
      g.restore();
    }

    for (const q of this.parts) {
      const t = q.life / q.max;
      if (q.kind === 'smoke') {
        g.fillStyle = q.color + (0.35 * t) + ')';
        g.beginPath(); g.arc(q.x, q.y, q.size * (1.6 - t), 0, TAU); g.fill();
      } else if (q.kind === 'spark') {
        g.strokeStyle = q.color;
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); g.stroke();
      } else {
        g.save();
        g.globalAlpha = Math.min(1, t * 2);
        g.translate(q.x, q.y);
        g.rotate(q.rot);
        g.fillStyle = q.color;
        if (q.kind === 'shell') g.fillRect(-1.5, -3, 3, 6);
        else g.fillRect(-q.size / 2, -q.size / 2, q.size, q.size * 0.7);
        g.restore();
      }
    }

    g.lineCap = 'round';
    for (const b of this.bullets) {
      if (b.rocket) { drawRocket(g, b); continue; }
      g.strokeStyle = 'rgba(255,220,120,.35)';
      g.lineWidth = 6;
      g.beginPath(); g.moveTo(b.px - b.vx * 0.012, b.py - b.vy * 0.012); g.lineTo(b.x, b.y); g.stroke();
      g.strokeStyle = '#fff6c8';
      g.lineWidth = 2.5;
      g.stroke();
    }

    const m = this.man;
    drawGunman(g, m.x, this.groundY, this.ms, m.aim, { ...m, gun: this.weapon.id });

    for (const s of this.texts) {
      const t = s.life / 0.8;
      g.save();
      g.translate(s.x, s.y);
      g.rotate(s.rot);
      g.scale(1 + (1 - t) * 0.3, 1 + (1 - t) * 0.3);
      g.globalAlpha = Math.min(1, t * 2.5);
      g.font = `${s.size}px Bungee, Impact, sans-serif`;
      g.textAlign = 'center';
      g.lineWidth = 6;
      g.strokeStyle = '#000';
      g.strokeText(s.text, 0, 0);
      g.fillStyle = s.color;
      g.fillText(s.text, 0, 0);
      g.restore();
    }
    g.restore();

    // crosshair
    if (this.pointer.active && this.state !== 'end') {
      const { x, y } = this.pointer;
      g.strokeStyle = this.pointer.down ? '#ff3b3b' : 'rgba(255,255,255,.85)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, 14, 0, TAU);
      g.moveTo(x - 22, y); g.lineTo(x - 8, y);
      g.moveTo(x + 8, y); g.lineTo(x + 22, y);
      g.moveTo(x, y - 22); g.lineTo(x, y - 8);
      g.moveTo(x, y + 8); g.lineTo(x, y + 22);
      g.stroke();
    }
  }
}

function jaggedPath(x, y, r, n, rough) {
  const g = new Path2D();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (i % 2 ? rand(rough, 0.95) : rand(0.95, 1.2));
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  return g;
}

function polyPath(pts) {
  const g = new Path2D();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  return g;
}

function drawRocket(g, b) {
  g.save();
  g.translate(b.x, b.y);
  g.rotate(Math.atan2(b.vy, b.vx));
  g.fillStyle = '#ff9f1c';
  g.beginPath(); g.moveTo(-14, -4); g.lineTo(-24 - Math.random() * 8, 0); g.lineTo(-14, 4); g.fill();
  g.fillStyle = '#4e7a3a';
  g.strokeStyle = '#14121c';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(-14, -4); g.lineTo(6, -4); g.lineTo(13, 0); g.lineTo(6, 4); g.lineTo(-14, 4); g.closePath();
  g.fill(); g.stroke();
  g.restore();
}
