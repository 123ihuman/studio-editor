/* Studio X · FREE backend proxy
   Run:  node proxy-free.js
   Serves on http://localhost:8788
   Zero paid APIs. All endpoints route to free open-source tools.
*/
const http = require('http');

const PORT = 8788;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS'){ res.writeHead(204); return res.end(); }

  const u = new URL(req.url, 'http://localhost');

  // --- Free TTS: Samantha Voice (HF Space) ---
  if (req.method === 'POST' && u.pathname === '/tts/samantha'){
    let body = '';
    for await (const c of req) body += c;
    const { text, lang } = JSON.parse(body || '{}');
    const up = await fetch('https://iamsudeep-samanthaai.hf.space/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: lang || 'en' })
    });
    const buf = Buffer.from(await up.arrayBuffer());
    res.writeHead(up.status, { 'Content-Type': 'audio/mpeg' });
    return res.end(buf);
  }

  // --- Free TTS: VoiceAPI (HF Space) ---
  if (req.method === 'POST' && u.pathname === '/tts/voiceapi'){
    let body = '';
    for await (const c of req) body += c;
    const { text, language } = JSON.parse(body || '{}');
    const up = await fetch('https://harshil748-voiceapi.hf.space/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language: language || 'en' })
    });
    const buf = Buffer.from(await up.arrayBuffer());
    res.writeHead(up.status, { 'Content-Type': 'audio/mpeg' });
    return res.end(buf);
  }

  // --- Free TTS: Voicebox (local) ---
  if (req.method === 'POST' && u.pathname === '/tts/voicebox'){
    let body = '';
    for await (const c of req) body += c;
    const { text, voice } = JSON.parse(body || '{}');
    const up = await fetch('http://localhost:17493/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: voice || 'default' })
    });
    const buf = Buffer.from(await up.arrayBuffer());
    res.writeHead(up.status, { 'Content-Type': 'audio/mpeg' });
    return res.end(buf);
  }

  // --- Free script writer: Groq ---
  if (req.method === 'POST' && u.pathname === '/script/groq'){
    let body = '';
    for await (const c of req) body += c;
    const { prompt, apiKey } = JSON.parse(body || '{}');
    const up = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-4-maverick-17b-128e-instruct',
        messages: [{ role:'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 800
      })
    });
    const j = await up.json();
    res.writeHead(up.status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(j));
  }

  // --- Free video generator: Agnes (proxy to their public API) ---
  if (req.method === 'POST' && u.pathname === '/video/agnes'){
    let body = '';
    for await (const c of req) body += c;
    const { prompt, scenes, voice } = JSON.parse(body || '{}');
    // Agnes Video Generator runs on your own machine or their public instance.
    // Point this at your local Agnes install if you self-host:
    const up = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, scenes, voice })
    });
    const j = await up.json();
    res.writeHead(up.status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(j));
  }

  res.writeHead(404);
  res.end('Not found. Routes: /tts/samantha, /tts/voiceapi, /tts/voicebox, /script/groq, /video/agnes');
});

server.listen(PORT, () => {
  console.log(`Studio X FREE proxy on http://localhost:${PORT}`);
  console.log('Zero paid APIs. All endpoints route to free open-source tools.');
});