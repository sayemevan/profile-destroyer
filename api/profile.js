// GET /api/profile?url=<profile link>
// Reads the public Open Graph tags of a profile page (name, picture, canonical URL).
// Also resolves Facebook "share" links (facebook.com/share/…) to the real profile.

import { fetchProfilePage, isProfileHost, metaTags, query, sendJson } from './_lib.js';

const BAD_TITLES = /^(facebook|instagram|x|page not found|tiktok.*)$|^(log ?in|sign up)\b/i;
const DAY = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';

export default async function handler(req, res) {
  let target;
  try {
    target = new URL(query(req).get('url') || '');
  } catch {
    return sendJson(res, 400, { error: 'bad url' });
  }
  if (target.protocol !== 'https:' || !isProfileHost(target.hostname)) {
    return sendJson(res, 400, { error: 'unsupported site' });
  }

  try {
    const { html, finalUrl } = await fetchProfilePage(target.href);
    const tags = metaTags(html);
    let url = tags['og:url'] || finalUrl;
    try { if (!isProfileHost(new URL(url).hostname)) url = finalUrl; } catch { url = finalUrl; }

    url = canonical(url);
    const name = cleanName(tags['og:title'] || tags['twitter:title'] || '');
    let image = tags['og:image'] || tags['twitter:image'] || null;
    if (image?.includes('pbs.twimg.com/profile_images/')) image = image.replace('_200x200.', '_400x400.');
    const loginWall = /\/login|checkpoint/.test(url);
    if (loginWall) return sendJson(res, 404, { error: 'profile not public' }, DAY);

    const result = {
      url,
      name: name && !BAD_TITLES.test(name) ? name : null,
      image: image && /^https:\/\//.test(image) ? image : null,
    };
    // Profile exists but shows nothing to logged-out visitors (private Facebook profiles).
    result.hidden = !result.name && !result.image;
    return sendJson(res, 200, result, DAY);
  } catch (err) {
    return sendJson(res, 502, { error: err.message });
  }
}

// Drop tracking params Facebook adds when it redirects a share link
// (…/profile.php?id=123&rdid=…&share_url=…).
function canonical(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)facebook\.com$/.test(u.hostname)) return url;
    const id = u.pathname === '/profile.php' && u.searchParams.get('id');
    u.search = id ? `?id=${id}` : '';
    u.hash = '';
    u.hostname = 'www.facebook.com';
    return u.href;
  } catch {
    return url;
  }
}

function cleanName(title) {
  return title
    .replace(/\s*\(@[^)]*\)\s*(on X|•.*|·.*)?$/i, '')   // X / Instagram / Threads: "Name (@handle) on X"
    .replace(/\s*[|•·]\s*(Facebook|Instagram|TikTok|LinkedIn|YouTube|Twitch).*$/i, '')
    .trim()
    .slice(0, 80);
}
