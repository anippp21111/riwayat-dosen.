const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const handlers = {
  '/api/search': require('../api/search'),
  '/api/roster': require('../api/roster'),
  '/api/detail': require('../api/detail'),
};
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (handlers[url.pathname]) {
    req.query = Object.fromEntries(url.searchParams.entries());
    const response = {
      status(code) { res.statusCode = code; return this; },
      setHeader(name, value) { res.setHeader(name, value); },
      json(data) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); return this; },
    };
    try { await handlers[url.pathname](req, response); }
    catch (error) { if (!res.writableEnded) response.status(500).json({ error: error.message || 'Terjadi kesalahan server.' }); }
    return;
  }

  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(`${root}${path.sep}`) && file !== path.join(root, 'index.html')) {
    res.writeHead(403).end('Forbidden'); return;
  }
  fs.readFile(file, (error, contents) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(contents);
  });
}).listen(Number(process.env.PORT || 3000), () => {
  console.log(`Riwayat Dosen PNL berjalan di http://localhost:${process.env.PORT || 3000}`);
});
