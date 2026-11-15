// Statischer Server für die fertige Seite (dist/) – für den Smoke-Test im Browser, ohne Astro.
// Ordner liefern ihre index.html, Unbekanntes die 404-Seite mit Status 404 (wie GitHub Pages).
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = 'dist';
const PORT = Number(process.env.PORT ?? 4321);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

async function serve(req: IncomingMessage, res: ServerResponse) {
  let path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  if (path.includes('..')) path = '/';
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    res.end(await readFile(join(ROOT, '404.html')).catch(() => 'Nicht gefunden'));
  }
}

createServer((req, res) => void serve(req, res)).listen(PORT, () => console.log(`dist/ auf http://localhost:${PORT}`));
