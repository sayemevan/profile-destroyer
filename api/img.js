// GET /api/img?src=<image url>
// Proxies profile pictures so the browser can draw them on a canvas and export it
// (most social CDNs don't send CORS headers). Responses are cached on the CDN, so
// each picture only costs one upstream request a day, which keeps unavatar.io's
// free quota (25/day per IP) from running out.

import { isImageHost, query } from './_lib.js';

const MAX = 5 * 1024 * 1024;

export default async function handler(req, res) {
  let src;
  try {
    src = new URL(query(req).get('src') || '');
  } catch {
    return fail(res, 400);
  }
  if (src.protocol !== 'https:' || !isImageHost(src.hostname)) return fail(res, 400);

  const headers = { 'User-Agent': 'ProfileDestroyerBot/1.0' };
  if (src.hostname === 'unavatar.io' && process.env.UNAVATAR_API_KEY) headers['x-api-key'] = process.env.UNAVATAR_API_KEY;

  try {
    const r = await fetch(src, { headers, signal: AbortSignal.timeout(9000) });
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !type.startsWith('image/')) return fail(res, r.status === 404 ? 404 : 502);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX) return fail(res, 413);
    res.statusCode = 200;
    res.setHeader('Content-Type', type);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800');
    res.end(buf);
  } catch {
    fail(res, 504);
  }
}

function fail(res, status) {
  res.statusCode = status;
  res.setHeader('Cache-Control', status === 404 ? 'public, s-maxage=3600' : 'no-store');
  res.end();
}
