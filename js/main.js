import { inject } from '@vercel/analytics';
import { loadProfile, profileFromFile, imageFromFile } from './profile.js';
import { Game, replayDamage } from './game.js';
import { makeShareImage, shareLink } from './share.js';
import { sfx } from './audio.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';
import { drawGun } from './gunman.js';
import { PRESETS, presetProfile } from './targets.js';
import { Clip } from './clip.js';

inject();

const $ = id => document.getElementById(id);
const SCREENS = ['home', 'game', 'result'];

let profile = null;
let result = null;
let imageBlob = null;
let imageUrl = null;
let shareUrl = null;
let video = null;

const params = new URLSearchParams(location.search);
const challenge = {
  target: params.get('t'),
  score: /^\d{1,3}$/.test(params.get('s') || '') ? Math.min(100, Number(params.get('s'))) : null,
  name: (params.get('n') || '').slice(0, 40),
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

// The round is recorded as a video clip from the first shot until the score stamp.
const clip = new Clip($('stage'));
game.onBegin = () => clip.start();
game.onFrame = () => clip.frame(game);

function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('active', s === id);
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2400);
}

const isChallengeTarget = () => challenge.score !== null && profile?.url && profile.url === challenge.target;

// ---------------------------------------------------------------- home

function loadTarget(input) {
  if (input.startsWith('preset:')) {
    const p = presetProfile(input.slice(7));
    if (!p) throw new Error('That target no longer exists.');
    return p;
  }
  return loadProfile(input);
}

$('urlForm').addEventListener('submit', e => {
  e.preventDefault();
  sfx.unlock();
  begin(() => loadTarget($('urlInput').value));
});

for (const p of PRESETS) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'preset';
  btn.innerHTML = `<span class="emoji">${p.emoji}</span>${p.name}`;
  btn.addEventListener('click', () => { sfx.unlock(); begin(() => presetProfile(p.id)); });
  $('presets').append(btn);
}

for (const [id, selfie] of [['fileInput', false], ['selfieInput', true]]) {
  $(id).addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) { sfx.unlock(); begin(() => profileFromFile(file, { selfie })); }
  });
}

async function begin(load) {
  $('homeError').hidden = true;
  $('loading').hidden = false;
  try {
    profile = await load();
    startGame();
  } catch (err) {
    show('home');
    $('homeError').textContent = err.message || 'Could not load that profile.';
    $('homeError').hidden = false;
  } finally {
    $('loading').hidden = true;
  }
}

function startGame() {
  $('meterLabel').textContent = isChallengeTarget() ? `BEAT ${challenge.score}%` : 'DESTROYED';
  show('game');
  game.start(profile);
}

// A friend's challenge link drops you straight into the same target.
if (challenge.target) {
  $('urlInput').value = challenge.target.startsWith('preset:') ? '' : challenge.target;
  if (challenge.score !== null) {
    $('challenge').textContent = `🔥 Someone destroyed ${challenge.score}% of this. Think you can beat it?`;
    $('challenge').hidden = false;
  }
  begin(async () => {
    const p = await loadTarget(challenge.target);
    if (p.private && challenge.name) p.name = challenge.name;
    return p;
  });
}

// ---------------------------------------------------------------- game

$('quitBtn').addEventListener('click', () => { game.stop(); clip.cancel(); show('home'); });
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

  let msg = `${res.weapon.name} · ${res.hits} hits · best combo ${res.bestCombo}`;
  if (isChallengeTarget()) {
    msg = pct > challenge.score ? `You beat your friend's ${challenge.score}%! 🏆`
      : pct === challenge.score ? `Tied with your friend at ${challenge.score}%!`
      : `Your friend did ${challenge.score}%. Go again!`;
  }
  $('resultMsg').textContent = msg;

  // Private profile played as a mystery card: offer to add the real photo/name now.
  $('fixPanel').hidden = !profile.hidden;
  $('fixName').value = profile.name === 'Mystery User' ? '' : profile.name;

  video = null;
  $('videoBtn').hidden = true;
  clip.stop().then(v => {
    if (result !== res || !v) return;
    video = v;
    $('videoBtn').hidden = false;
  });

  await renderShare();
}

// Builds the share image and link for the current result (again after a fix-up).
async function renderShare() {
  const res = result;
  const canvas = await makeShareImage(res);
  imageBlob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
  if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
  imageUrl = imageBlob ? URL.createObjectURL(imageBlob) : canvas.toDataURL('image/jpeg', 0.9);
  $('resultImg').src = imageUrl;

  shareUrl = shareLink(profile, res.pct);
  show('result');
}

// Re-draws the same wreckage on the real photo/name the player just added.
async function applyFix(avatar) {
  const name = $('fixName').value.trim();
  if (name) {
    profile.name = name;
    profile.handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || profile.handle;
  }
  if (avatar) {
    profile.avatar = avatar;
    profile.hidden = false;
  }
  Object.assign(result, replayDamage(profile, result.ops));
  $('fixPanel').hidden = !profile.hidden;
  await renderShare();
  toast(avatar ? 'Photo added!' : 'Name added!');
}

$('fixFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    await applyFix(await imageFromFile(file));
  } catch (err) {
    toast(err.message);
  }
});
$('fixSave').addEventListener('click', () => applyFix(null));

function download(href, name) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

const saveImage = () => download(imageUrl, `destroyed-${profile.handle}-${result.pct}.jpg`);

function imageFile() {
  return imageBlob && new File([imageBlob], `destroyed-${profile.handle}.jpg`, { type: 'image/jpeg' });
}

function videoFile() {
  if (!video) return null;
  const ext = video.type.includes('mp4') ? 'mp4' : 'webm';
  return new File([video], `destroyed-${profile.handle}.${ext}`, { type: video.type });
}

// Shares a file (image or video) on its own. Text/links are left out on purpose:
// several apps (Facebook, WhatsApp) drop the file when a link comes along with it.
// The image itself carries the Sayem Dreams page/channel.
async function shareFile(file) {
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (err) {
      if (err.name !== 'AbortError') toast('Sharing failed. Try saving it instead.');
    }
    return true;
  }
  return false;
}

$('shareBtn').addEventListener('click', async () => {
  if (await shareFile(imageFile())) return;
  saveImage();
  toast('Image saved. Post it anywhere!');
});

$('videoBtn').addEventListener('click', async () => {
  const file = videoFile();
  if (!file || await shareFile(file)) return;
  const url = URL.createObjectURL(file);
  download(url, file.name);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('Video saved!');
});

$('dlBtn').addEventListener('click', saveImage);

$('copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareUrl);
    toast('Link copied!');
  } catch {
    toast('Could not copy the link.');
  }
});

$('againBtn').addEventListener('click', startGame);
$('newBtn').addEventListener('click', () => {
  $('urlInput').value = '';
  $('homeError').hidden = true;
  show('home');
});
