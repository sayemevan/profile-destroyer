import { loadProfile, profileFromFile } from './profile.js';
import { Game } from './game.js';
import { makeShareImage, shareLink, shareText, socialUrls } from './share.js';
import { sfx } from './audio.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';
import { drawGun } from './gunman.js';

const $ = id => document.getElementById(id);
const SCREENS = ['home', 'game', 'result'];

let profile = null;
let result = null;
let imageBlob = null;
let imageUrl = null;

const params = new URLSearchParams(location.search);
const challenge = {
  target: params.get('t'),
  score: /^\d{1,3}$/.test(params.get('s') || '') ? Math.min(100, Number(params.get('s'))) : null,
};

const game = new Game($('stage'), {
  pct: $('pct'),
  bar: $('bar'),
  timer: $('timer'),
  combo: $('combo'),
  countdown: $('countdown'),
  hint: $('hint'),
  onEnd: showResult,
});

function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('active', s === id);
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2000);
}

// ---------------------------------------------------------------- home

if (challenge.target) {
  $('urlInput').value = challenge.target;
  if (challenge.score !== null) {
    $('challenge').textContent = `🔥 Someone destroyed ${challenge.score}% of this profile. Think you can beat it?`;
    $('challenge').hidden = false;
  }
}

$('urlForm').addEventListener('submit', e => {
  e.preventDefault();
  sfx.unlock();
  begin(() => loadProfile($('urlInput').value));
});

$('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) { sfx.unlock(); begin(() => profileFromFile(file)); }
});

async function begin(load) {
  $('homeError').hidden = true;
  $('loading').hidden = false;
  try {
    profile = await load();
    show('game');
    game.start(profile);
  } catch (err) {
    $('homeError').textContent = err.message || 'Could not load that profile.';
    $('homeError').hidden = false;
  } finally {
    $('loading').hidden = true;
  }
}

// ---------------------------------------------------------------- game

$('quitBtn').addEventListener('click', () => { game.stop(); show('home'); });
$('muteBtn').addEventListener('click', () => { $('muteBtn').textContent = sfx.toggle() ? '🔇' : '🔊'; });

// Weapon picker: works before and during a round; the choice is remembered.
function buildWeaponBar() {
  let saved = 'pistol';
  try { saved = localStorage.getItem('pd-weapon') || saved; } catch { /* storage blocked */ }
  for (const id of WEAPON_ORDER) {
    const btn = document.createElement('button');
    btn.className = 'weapon';
    btn.setAttribute('role', 'radio');
    btn.dataset.id = id;
    const icon = document.createElement('canvas');
    icon.width = 108; icon.height = 52;
    const g = icon.getContext('2d');
    g.translate(id === 'bazooka' ? 24 : id === 'shotgun' ? 14 : 4, 28);
    g.scale(id === 'bazooka' ? 0.85 : id === 'shotgun' ? 1.2 : 1.6, id === 'bazooka' ? 0.85 : id === 'shotgun' ? 1.2 : 1.6);
    g.translate(-14, 0);
    drawGun(g, id);
    btn.append(icon, WEAPONS[id].name);
    btn.addEventListener('click', () => selectWeapon(id));
    $('weapons').append(btn);
  }
  selectWeapon(WEAPONS[saved] ? saved : 'pistol');
}

function selectWeapon(id) {
  game.setWeapon(id);
  for (const b of $('weapons').children) b.setAttribute('aria-checked', String(b.dataset.id === id));
  try { localStorage.setItem('pd-weapon', id); } catch { /* storage blocked */ }
}
buildWeaponBar();

// ---------------------------------------------------------------- result

async function showResult(res) {
  result = res;
  const { pct } = res;
  const canvas = await makeShareImage(res);
  imageBlob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = imageBlob ? URL.createObjectURL(imageBlob) : canvas.toDataURL('image/png');
  $('resultImg').src = imageUrl;

  let msg = `${res.weapon.name} · ${res.hits} hits · best combo ${res.bestCombo}`;
  if (challenge.score !== null && profile.url && profile.url === challenge.target) {
    msg = pct > challenge.score ? `You beat your friend's ${challenge.score}%! 🏆`
      : pct === challenge.score ? `Tied with your friend at ${challenge.score}%!`
      : `Your friend did ${challenge.score}%. Go again!`;
  }
  $('resultMsg').textContent = msg;

  const link = shareLink(profile, pct);
  const urls = socialUrls(shareText(profile, pct, res.weapon), link);
  $('xBtn').href = urls.x;
  $('fbBtn').href = urls.facebook;
  $('waBtn').href = urls.whatsapp;
  show('result');
}

$('shareBtn').addEventListener('click', async () => {
  const text = shareText(profile, result.pct, result.weapon);
  const url = shareLink(profile, result.pct);
  const file = imageBlob && new File([imageBlob], 'profile-destroyed.png', { type: 'image/png' });
  try {
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: `${text} ${url}` });
    } else if (navigator.share) {
      await navigator.share({ text, url });
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast('Copied! Paste it anywhere.');
    }
  } catch (err) {
    if (err.name !== 'AbortError') toast('Sharing failed. Try Save image instead.');
  }
});

$('dlBtn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = imageUrl;
  a.download = `destroyed-${profile.handle}-${result.pct}.png`;
  a.click();
});

$('copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareLink(profile, result.pct));
    toast('Link copied!');
  } catch {
    toast('Could not copy the link.');
  }
});

$('againBtn').addEventListener('click', () => { show('game'); game.start(profile); });
$('newBtn').addEventListener('click', () => { $('urlInput').value = ''; show('home'); });
