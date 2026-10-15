// Turns a pasted profile link into { service, handle, name, bio, stats, avatar }.
// Avatars come from unavatar.io (CORS-enabled, so the canvas stays exportable).

const SERVICES = [
  { id: 'x', name: 'X', color: '#111111', hosts: ['x.com', 'twitter.com'], avatar: 'x' },
  { id: 'instagram', name: 'Instagram', color: '#d62976', hosts: ['instagram.com'], avatar: 'instagram' },
  { id: 'github', name: 'GitHub', color: '#24292f', hosts: ['github.com'], avatar: 'github' },
  { id: 'youtube', name: 'YouTube', color: '#e00000', hosts: ['youtube.com'], avatar: 'youtube' },
  { id: 'tiktok', name: 'TikTok', color: '#111111', hosts: ['tiktok.com'], avatar: 'tiktok' },
  { id: 'reddit', name: 'Reddit', color: '#ff4500', hosts: ['reddit.com', 'old.reddit.com'], avatar: 'reddit' },
  { id: 'twitch', name: 'Twitch', color: '#9146ff', hosts: ['twitch.tv'], avatar: 'twitch' },
  { id: 'bluesky', name: 'Bluesky', color: '#1185fe', hosts: ['bsky.app'], avatar: 'bluesky' },
  { id: 'threads', name: 'Threads', color: '#111111', hosts: ['threads.net', 'threads.com'], avatar: 'instagram' },
  { id: 'facebook', name: 'Facebook', color: '#1877f2', hosts: ['facebook.com', 'fb.com'], avatar: null },
  { id: 'linkedin', name: 'LinkedIn', color: '#0a66c2', hosts: ['linkedin.com'], avatar: null },
];

// Paths that are clearly not profiles (posts, feeds, settings…).
const NOT_PROFILE = new Set(['home', 'explore', 'search', 'settings', 'i', 'intent', 'share', 'watch',
  'p', 'reel', 'reels', 'status', 'stories', 'hashtag', 'notifications', 'messages', 'login', 'feed']);

const GAG_BIOS = [
  'Certified main character. Has never been wrong (citation needed).',
  'Professional scroller. Part-time opinion haver.',
  'Thought this profile was indestructible. It was not.',
  'Living rent-free in the algorithm.',
];
const GAG_STATS = [['∞', 'Ego'], ['9001', 'Aura'], ['+1', 'Haters']];

export function parseTarget(input) {
  let s = (input || '').trim();
  if (!s) throw new Error('Paste a profile link first.');

  // A bare "@name" or "name" is treated as an X handle.
  const bare = s.replace(/^@/, '');
  if (!/[/.]/.test(bare)) {
    if (!/^[\w]{1,30}$/.test(bare)) throw new Error('That does not look like a username.');
    return { svc: SERVICES[0], handle: bare, url: `https://x.com/${bare}` };
  }

  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let url;
  try { url = new URL(s); } catch { throw new Error('That link does not look right.'); }

  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, '');
  const svc = SERVICES.find(x => x.hosts.includes(host))
    || { id: 'web', name: host, color: '#4b4b63', hosts: [host], avatar: null, site: host };
  const segs = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const first = (segs[0] || '').toLowerCase();

  let handle;
  switch (svc.id) {
    case 'youtube':
      handle = segs[0]?.startsWith('@') ? segs[0] : ['c', 'user', 'channel'].includes(first) ? segs[1] : segs[0];
      break;
    case 'reddit':
      handle = ['u', 'user'].includes(first) ? segs[1] : null;
      break;
    case 'linkedin':
      handle = ['in', 'company'].includes(first) ? segs[1] : null;
      break;
    case 'bluesky':
      handle = first === 'profile' ? segs[1] : null;
      break;
    case 'facebook':
      handle = first === 'profile.php' ? url.searchParams.get('id') : segs[0];
      break;
    case 'web':
      handle = segs[0] || host;
      break;
    default:
      handle = segs[0];
  }

  if (svc.id !== 'web' && NOT_PROFILE.has(first)) {
    throw new Error('That looks like a post or page link. Paste the profile link instead.');
  }
  handle = (handle || '').replace(/^@/, '');
  if (!handle) throw new Error(`Could not find a username in that ${svc.name} link.`);

  return { svc, handle, url: url.href };
}

export async function loadProfile(input) {
  const { svc, handle, url } = parseTarget(input);
  const profile = {
    service: svc, handle, url,
    name: handle,
    bio: GAG_BIOS[Math.floor(Math.random() * GAG_BIOS.length)],
    stats: GAG_STATS,
    avatar: null,
  };

  const sources = [];
  if (svc.id === 'github') {
    try {
      const r = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`);
      if (r.ok) {
        const d = await r.json();
        profile.name = d.name || d.login;
        profile.handle = d.login;
        if (d.bio) profile.bio = d.bio;
        profile.stats = [[compact(d.followers), 'Followers'], [compact(d.following), 'Following'], [compact(d.public_repos), 'Repos']];
        sources.push(d.avatar_url + (d.avatar_url.includes('?') ? '&' : '?') + 's=400');
      } else if (r.status === 404) {
        throw new Error(`No GitHub user called "${handle}".`);
      }
    } catch (e) {
      if (e.message.startsWith('No GitHub')) throw e;
    }
  }
  if (svc.avatar) sources.push(`https://unavatar.io/${svc.avatar}/${encodeURIComponent(handle)}?fallback=false`);
  if (svc.site) sources.push(`https://unavatar.io/${encodeURIComponent(svc.site)}?fallback=false`);

  for (const src of sources) {
    try { profile.avatar = await loadImage(src, 9000); break; } catch { /* try next */ }
  }
  if (!profile.avatar) profile.avatar = initialsAvatar(handle, svc.color);
  return profile;
}

export async function profileFromFile(file) {
  if (!file.type.startsWith('image/')) throw new Error('Please pick an image file.');
  const src = URL.createObjectURL(file);
  const avatar = await loadImage(src, 15000);
  return {
    service: { id: 'photo', name: 'Photo', color: '#ff3b7a' },
    handle: 'mystery_target',
    url: null,
    name: 'Mystery Target',
    bio: GAG_BIOS[Math.floor(Math.random() * GAG_BIOS.length)],
    stats: GAG_STATS,
    avatar,
  };
}

function loadImage(src, timeout) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => { img.src = ''; reject(new Error('timeout')); }, timeout);
    if (!src.startsWith('blob:')) img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('load failed')); };
    img.src = src;
  });
}

function initialsAvatar(handle, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, color);
  grad.addColorStop(1, '#ff5d9e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#fff';
  g.font = 'bold 120px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(handle.slice(0, 2).toUpperCase(), 128, 136);
  return c;
}

function compact(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}
