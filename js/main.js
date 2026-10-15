import { loadProfile, profileFromFile, imageFromFile, initialsAvatar } from './profile.js';
import { Game } from './game.js';
import { makeShareImage, shareLink, shareText, socialUrls, caption } from './share.js';
import { sfx } from './audio.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';
import { drawGun } from './gunman.js';

const $ = id => document.getElementById(id);
const SCREENS = ['home', 'game', 'result'];

let profile = null;
let result = null;
let imageBlob = null;
let imageUrl = null;
let shareUrl = null;

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
  $('privatePanel').hidden = true;
  $('loading').hidden = false;
  try {
    profile = await load();
    if (profile.hidden) {
      $('privName').value = '';
      $('privatePanel').hidden = false;
      return;
    }
    startGame();
  } catch (err) {
    $('homeError').textContent = err.message || 'Could not load that profile.';
    $('homeError').hidden = false;
  } finally {
    $('loading').hidden = true;
  }
}

// Private Facebook profile: let the player supply the photo and name.
function finishPrivate(avatar) {
  const name = $('privName').value.trim();
  if (name) {
    profile.name = name;
    profile.handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || profile.handle;
  }
  if (avatar) profile.avatar = avatar;
  else if (name) profile.avatar = initialsAvatar(name.replace(/\W/g, ''), profile.service.color);
  profile.hidden = false;
  $('privatePanel').hidden = true;
  startGame();
}

$('privFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    finishPrivate(await imageFromFile(file));
  } catch (err) {
    $('homeError').textContent = err.message;
    $('homeError').hidden = false;
  }
});
$('privSkip').addEventListener('click', () => finishPrivate(null));

function startGame() {
  show('game');
  game.start(profile);
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
  imageBlob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = imageBlob ? URL.createObjectURL(imageBlob) : canvas.toDataURL('image/jpeg', 0.9);
  $('resultImg').src = imageUrl;

  let msg = `${res.weapon.name} · ${res.hits} hits · best combo ${res.bestCombo}`;
  if (challenge.score !== null && profile.url && profile.url === challenge.target) {
    msg = pct > challenge.score ? `You beat your friend's ${challenge.score}%! 🏆`
      : pct === challenge.score ? `Tied with your friend at ${challenge.score}%!`
      : `Your friend did ${challenge.score}%. Go again!`;
  }
  $('resultMsg').textContent = msg;

  // Start with the plain challenge link; swap in the short /s/<id> link (which
  // has the image as its preview) once the upload finishes.
  shareUrl = shareLink(profile, pct);
  setSocialLinks();
  setPreparing(true);
  show('result');
  const url = await uploadShare(canvas, res);
  if (result !== res) return;
  if (url) shareUrl = url;
  setSocialLinks();
  setPreparing(false);
}

async function uploadShare(canvas, res) {
  try {
    const r = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: canvas.toDataURL('image/jpeg', 0.85),
        pct: res.pct,
        handle: profile.handle,
        service: profile.service.name,
        target: profile.url,
        weapon: res.weapon.name,
      }),
      signal: AbortSignal.timeout(15000),
    });
    return r.ok ? (await r.json()).url : null;
  } catch {
    return null;
  }
}

function setSocialLinks() {
  const urls = socialUrls(shareText(profile, result.pct, result.weapon), shareUrl);
  $('fbBtn').href = urls.facebook;
  $('waBtn').href = urls.whatsapp;
  $('xBtn').href = urls.x;
}

function setPreparing(on) {
  for (const id of ['fbBtn', 'waBtn', 'xBtn', 'copyBtn']) $(id).classList.toggle('busy', on);
}

function saveImage() {
  const a = document.createElement('a');
  a.href = imageUrl;
  a.download = `destroyed-${profile.handle}-${result.pct}.jpg`;
  a.click();
}

function imageFile() {
  return imageBlob && new File([imageBlob], `destroyed-${profile.handle}.jpg`, { type: 'image/jpeg' });
}

// Post text with the game link and Sayem Dreams' page/channel, ready to paste.
function copyCaption() {
  const text = caption(shareText(profile, result.pct, result.weapon), shareUrl);
  return navigator.clipboard?.writeText(text).then(() => true, () => false) ?? Promise.resolve(false);
}

// Shares the picture itself. Text/links are left out on purpose: several apps
// (Facebook, WhatsApp) drop the image when a link comes along with it. The caption
// (with clickable links) goes to the clipboard instead, for pasting into the post.
async function shareImage() {
  const file = imageFile();
  const copied = copyCaption(); // started before share() so the tap still counts for it
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      if (await copied) toast('Caption with links copied. Paste it in your post!');
    } catch (err) {
      if (err.name !== 'AbortError') toast('Sharing failed. Try Save image instead.');
    }
    return true;
  }
  return false;
}

$('shareBtn').addEventListener('click', async () => {
  if (await shareImage()) return;
  saveImage();
  toast((await copyCaption()) ? 'Image saved & caption copied. Post it anywhere!' : 'Image saved. Post it anywhere!');
});

// Facebook's web share can only post a link (no image, no text). On phones, hand
// the image to the Facebook app instead; on desktop fall back to the link share.
$('fbBtn').addEventListener('click', e => {
  const file = imageFile();
  if (file && navigator.canShare?.({ files: [file] })) {
    e.preventDefault();
    shareImage();
  }
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
$('newBtn').addEventListener('click', () => { $('urlInput').value = ''; show('home'); });
