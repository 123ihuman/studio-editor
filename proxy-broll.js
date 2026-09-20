/* Studio X · Free B-roll proxy
   Run:  node proxy-broll.js
   Serves on http://localhost:8789
   Proxies Pexels / Pixabay video downloads so the browser can use them
   without hitting CORS restrictions on the canvas.
*/
const http = require('http');

const PORT = 8789;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS'){ res.writeHead(204); return res.end(); }

  const u = new URL(req.url, 'http://localhost');

  if (u.pathname === '/video'){
    const target = u.searchParams.get('url');
    if (!target){ res.writeHead(400); return res.end('Missing url param'); }
    try {
      const up = await fetch(target, {
        headers: { 'User-Agent': 'StudioX/1.0' }
      });
      res.writeHead(up.status, {
        'Content-Type': up.headers.get('content-type') || 'video/mp4',
        'Cache-Control': 'public, max-age=3600'
      });
      const reader = up.body.getReader();
      while (true){
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch(e){
      res.writeHead(500); res.end('Proxy error: ' + e.message);
    }
    return;
  }

  res.writeHead(404);
  res.end('Routes: GET /video?url=...');
});

server.listen(PORT, () => {
  console.log(`Studio X B-roll proxy on http://localhost:${PORT}`);
  console.log('GET /video?url=<pexels-or-pixabay-direct-url>');
});