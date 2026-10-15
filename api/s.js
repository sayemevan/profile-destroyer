// GET /s/<id>  (rewritten to /api/s?id=<id>)
// The page people land on from a shared link. Crawlers read the og:image (the
// before/after picture); people see it with a Play button and Sayem Dreams'
// Follow / Subscribe buttons.

import { escapeHtml, getJson, origin, query } from './_lib.js';

// Keep in sync with js/brand.js.
const BRAND = {
  name: 'Sayem Dreams',
  facebook: 'https://www.facebook.com/sayemdreams',
  youtube: 'https://www.youtube.com/@SayemDreams?sub_confirmation=1',
};

export default async function handler(req, res) {
  const id = query(req).get('id') || '';
  const meta = /^[\w-]{8}$/.test(id) ? await getJson(`shares/${id}.json`) : null;
  const base = origin(req);
  if (!meta) {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }

  const image = meta.image.startsWith('http') ? meta.image : base + meta.image;
  const who = meta.label || (meta.target ? `@${meta.handle}'s ${meta.service} profile` : 'this profile');
  const title = `${meta.pct}% DESTROYED 💥 ${who}`;
  const desc = `Blasted with a ${meta.weapon || 'gun'} on Profile Destroyer by ${BRAND.name}. Think you can do more damage? Play free!`;
  const name = meta.name ? `&n=${encodeURIComponent(meta.name)}` : '';
  const game = meta.target ? `/?t=${encodeURIComponent(meta.target)}&s=${meta.pct}${name}` : '/';
  const e = escapeHtml;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400');
  res.end(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Profile Destroyer">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:url" content="${e(`${base}/s/${id}`)}">
<meta property="og:image" content="${e(image)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1080">
<meta property="og:image:height" content="1080">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(title)}">
<meta name="twitter:description" content="${e(desc)}">
<meta name="twitter:image" content="${e(image)}">
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #251a42; color: #fff;
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 16px; }
  main { width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: 12px; }
  img { width: 100%; border-radius: 16px; border: 3px solid #000; }
  a { display: block; padding: 14px 18px; color: #111; font-weight: 800; font-size: 17px;
      border: 3px solid #000; border-radius: 14px; text-decoration: none; box-shadow: 4px 4px 0 #000; }
  .play { background: #ffd23f; }
  .row { display: flex; gap: 10px; }
  .row a { flex: 1; color: #fff; }
  .fb { background: #1877f2; }
  .yt { background: #ff0000; }
  p { margin: 4px 0 0; color: #c9bfe6; font-size: 14px; }
</style>
</head>
<body>
<main>
  <img src="${e(image)}" alt="${e(title)}">
  <a class="play" href="${e(game)}">💥 Your turn: destroy it</a>
  <p>Made by <b>${e(BRAND.name)}</b>. Follow for more fun stuff!</p>
  <div class="row">
    <a class="fb" href="${e(BRAND.facebook)}" target="_blank" rel="noopener">👍 Follow</a>
    <a class="yt" href="${e(BRAND.youtube)}" target="_blank" rel="noopener">▶ Subscribe</a>
  </div>
</main>
</body>
</html>`);
}
