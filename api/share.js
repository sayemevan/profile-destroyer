// POST /api/share  { image: "data:image/jpeg;base64,…", pct, handle, service, target, weapon }
// Stores the before/after image and returns a short link (/s/<id>) whose page carries
// og:image, so Facebook / WhatsApp / X show the picture in the link preview.

import { randomBytes } from 'node:crypto';
import { isProfileHost, origin, putFile, readBody, sendJson } from './_lib.js';

const MAX_IMAGE = 1_500_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });

  let body;
  try {
    body = await readBody(req, MAX_IMAGE * 1.4 + 4096);
  } catch {
    return sendJson(res, 413, { error: 'too large' });
  }

  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(body?.image || '');
  const img = m && Buffer.from(m[1], 'base64');
  if (!img || img.length > MAX_IMAGE || img[0] !== 0xff || img[1] !== 0xd8) {
    return sendJson(res, 400, { error: 'image must be a JPEG under 1.5 MB' });
  }

  const pct = Math.round(Number(body.pct));
  if (!(pct >= 0 && pct <= 100)) return sendJson(res, 400, { error: 'bad score' });
  const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').slice(0, max);
  let target = null;
  try {
    const u = new URL(body.target);
    if (u.protocol === 'https:' && isProfileHost(u.hostname)) target = u.href;
  } catch { /* uploaded photo: no target */ }

  const id = randomBytes(6).toString('base64url');
  try {
    const image = await putFile(`shares/${id}.jpg`, img, 'image/jpeg');
    const meta = {
      id, image, pct, target,
      handle: text(body.handle, 60),
      service: text(body.service, 30),
      weapon: text(body.weapon, 20),
      created: new Date().toISOString(),
    };
    await putFile(`shares/${id}.json`, JSON.stringify(meta), 'application/json');
    return sendJson(res, 200, { id, url: `${origin(req)}/s/${id}` });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
