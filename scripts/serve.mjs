import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/recite' || path === '/recite/') { res.writeHead(302, { Location: '/' }).end(); return; }
    const rel = path === '/' ? 'index.html' : path.replace(/^\//, '');
    let file = resolve(root, rel);
    if (!file.startsWith(root + sep) || rel.split('/').some(part => part.startsWith('.'))) { res.writeHead(403).end(); return; }
    let info = await stat(file).catch(() => null);
    if (!info?.isFile()) { file = resolve(root, 'public', rel); info = await stat(file).catch(() => null); }
    if (!info?.isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
  } catch { res.writeHead(400).end('Bad request'); }
}).listen(5173, '127.0.0.1', () => console.log('HafizAssist: http://localhost:5173'));
