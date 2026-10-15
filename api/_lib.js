// Shared helpers for the API functions. Files starting with "_" are not routes on Vercel.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const BOT_UA = 'Mozilla/5.0 (compatible; ProfileDestroyerBot/1.0; +https://github.com/sayemevan/profile-destroyer)';

// Only these sites are ever fetched server-side (no open proxy / SSRF).
const PROFILE_HOSTS = [
  'facebook.com', 'fb.com', 'instagram.com', 'x.com', 'twitter.com', 'threads.net', 'threads.com',
  'tiktok.com', 'youtube.com', 'github.com', 'reddit.com', 'twitch.tv', 'bsky.app', 'linkedin.com',
];
const IMAGE_HOSTS = [
  'fbcdn.net', 'fbsbx.com', 'cdninstagram.com', 'twimg.com', 'unavatar.io', 'githubusercontent.com',
  'ggpht.com', 'googleusercontent.com', 'ytimg.com', 'redditmedia.com', 'redd.it', 'jtvnw.net',
  'bsky.app', 'tiktokcdn.com', 'tiktokcdn-us.com', 'licdn.com',
];

const matches = (host, list) => list.some(d => host === d || host.endsWith('.' + d));
export const isProfileHost = host => matches(host.toLowerCase(), PROFILE_HOSTS);
export const isImageHost = host => matches(host.toLowerCase(), IMAGE_HOSTS);

export function query(req) {
  return new URL(req.url, 'http://localhost').searchParams;
}

export function origin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || (host?.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export function sendJson(res, status, data, cache = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(JSON.stringify(data));
}

export async function readBody(req, limit) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// Fetch a profile page, following redirects only while they stay on allowed hosts.
export async function fetchProfilePage(url) {
  let current = new URL(url);
  for (let hop = 0; hop < 5; hop++) {
    if (current.protocol !== 'https:' || !isProfileHost(current.hostname)) throw new Error('host not allowed');
    const r = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': BOT_UA, 'Accept-Language': 'en-US,en;q=0.8', Accept: 'text/html' },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      current = new URL(r.headers.get('location'), current);
      continue;
    }
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const html = (await r.text()).slice(0, 1_500_000);
    return { html, finalUrl: current.href };
  }
  throw new Error('too many redirects');
}

export function metaTags(html) {
  const out = {};
  for (const m of html.matchAll(/<meta\s+[^>]*?(?:property|name)="(og:[a-z:]+|twitter:[a-z:]+)"[^>]*?content="([^"]*)"/gi)) {
    if (!(m[1] in out)) out[m[1]] = decodeEntities(m[2]);
  }
  for (const m of html.matchAll(/<meta\s+[^>]*?content="([^"]*)"[^>]*?(?:property|name)="(og:[a-z:]+)"/gi)) {
    if (!(m[2] in out)) out[m[2]] = decodeEntities(m[1]);
  }
  return out;
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------- storage
// Vercel Blob in production (needs BLOB_READ_WRITE_TOKEN); a local .data/ folder in dev.

const LOCAL_DIR = path.join(process.cwd(), '.data');
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function putFile(name, body, contentType) {
  if (useBlob()) {
    const { put } = await import('@vercel/blob');
    const r = await put(name, body, { access: 'public', contentType, addRandomSuffix: false });
    return r.url;
  }
  if (process.env.VERCEL) throw new Error('Blob storage is not connected (BLOB_READ_WRITE_TOKEN missing)');
  const file = path.join(LOCAL_DIR, name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return `/.data/${name}`;
}

export async function getJson(name) {
  try {
    if (useBlob()) {
      const { head } = await import('@vercel/blob');
      const h = await head(name);
      const r = await fetch(h.url);
      return r.ok ? await r.json() : null;
    }
    return JSON.parse(await readFile(path.join(LOCAL_DIR, name), 'utf8'));
  } catch {
    return null;
  }
}
