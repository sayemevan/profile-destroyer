// Local dev server: serves the static site and runs the /api functions the same
// way Vercel does.
//   npm run dev  →  http://localhost:8765

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.PORT) || 8765;
const ROOT = process.cwd();
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    const api = /^\/api\/([a-z]+)$/.exec(new URL(req.url, 'http://x').pathname);
    if (api) {
      const mod = await import(`./api/${api[1]}.js?t=${Date.now()}`);
      return await mod.default(req, res);
    }

    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) throw Object.assign(new Error('forbidden'), { code: 'ENOENT' });
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch (err) {
    res.statusCode = err.code === 'ENOENT' || err.code === 'ERR_MODULE_NOT_FOUND' ? 404 : 500;
    if (res.statusCode === 500) console.error(err);
    res.end(res.statusCode === 404 ? 'Not found' : 'Server error');
  }
}).listen(PORT, () => console.log(`Profile Destroyer dev server: http://localhost:${PORT}`));
