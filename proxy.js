/* Studio X · Voice clone proxy
   Run:  node proxy.js
   Serves on http://localhost:8787
   Endpoint: POST /tts  { provider, text, voice, model }
   Header:   x-api-key: <YOUR KEY>
*/
const http = require('http');

const PORT = 8787;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS'){ res.writeHead(204); return res.end(); }

    // Allow optional GET /t2v/status?id=...
  if (req.method === 'GET' && req.url.startsWith('/t2v/status')){
    const u = new URL(req.url, 'http://localhost');
    const id = u.searchParams.get('id');
    const key = req.headers['x-api-key'];
    const provider = (req.headers['x-provider'] || 'd-id').toLowerCase();
    try {
      let up;
      if (provider === 'd-id'){
        up = await fetch('https://api.d-id.com/talks/' + id, {
          headers: { 'Authorization': 'Basic ' + key }
        });
      } else if (provider === 'heygen'){
        up = await fetch('https://api.heygen.com/v3/video-agents/' + id, {
          headers: { 'x-api-key': key }
        });
      } else {
        up = await fetch('https://api.synthesia.io/v2/videos/' + id, {
          headers: { 'Authorization': key }
        });
      }
      const j = await up.json();
      res.writeHead(up.status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(j));
    } catch(e){
      res.writeHead(500); return res.end('Poll error: ' + e.message);
    }
  }

  if (req.method !== 'POST'){
    res.writeHead(404); return res.end('Not found');
  }

  let body = '';
  for await (const chunk of req) body += chunk;
  const { provider, text, voice, model } = JSON.parse(body || '{}');
  const key = req.headers['x-api-key'];
  if (!key){ res.writeHead(401); return res.end('Missing x-api-key'); }

  try {
    let upstream, audioType = 'audio/mpeg';

    if (provider === 'elevenlabs'){
      upstream = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice || '21m00Tcm4TlvDq8ikWAM'}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': key,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text,
            model_id: model || 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
          })
        }
      );
    } else if (provider === 'openai'){
      upstream = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          voice: voice || 'alloy',
          input: text,
          response_format: 'mp3'
        })
      });
        } else if (provider === 'replicate') {
      // Replicate uses a 2-step predict flow
      const start = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': 'Token ' + key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          version: model || 'a00d0c0ea4c48e2b4d3eb1e2b37ba0b8d1a4a4a3b83b0c1b07a7a5f5a0f8e1c9',
          input: { image: 'data:image/png;base64,PLACEHOLDER', prompt: text }
        })
      });
      const pred = await start.json();
      // Poll
      let out = pred;
      while (out.status !== 'succeeded' && out.status !== 'failed'){
        await new Promise(r => setTimeout(r, 1200));
        const p = await fetch(out.urls.get, { headers: { 'Authorization': 'Token ' + key } });
        out = await p.json();
      }
      if (out.status !== 'succeeded'){
        res.writeHead(500); return res.end(JSON.stringify(out));
      }
      const imgUrl = Array.isArray(out.output) ? out.output[0] : out.output;
      const imgRes = await fetch(imgUrl);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(buf);

    } else if (provider === 'stability') {
      const form = new FormData();
      form.append('init_image', new Blob([Buffer.from(text, 'base64')]));
      form.append('text_prompts[0][text]', 'cinematic');
      form.append('text_prompts[0][weight]', '1');
      const up = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key },
        body: form
      });
      const j = await up.json();
      const b64 = j.artifacts && j.artifacts[0] && j.artifacts[0].base64;
      if (!b64) { res.writeHead(500); return res.end(JSON.stringify(j)); }
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(Buffer.from(b64, 'base64'));

        } else if (provider === 'celebvoice') {
      const { voiceId, text, provider: ttsProvider } = JSON.parse(body || '{}');
      let up;
      if (ttsProvider === 'unmixr'){
        up = await fetch('https://api.unmixr.com/v1/tts', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ voice_id: voiceId, text, output_format: 'mp3' })
        });
      } else if (ttsProvider === 'modelslab'){
        up = await fetch('https://modelslab.com/api/v6/voice/voice_cover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model_id: voiceId, prompt: text, key })
        });
      } else {
        up = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
          method: 'POST',
          headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' })
        });
      }
      if (!up.ok){ res.writeHead(up.status); return res.end(await up.text()); }
      const buf = Buffer.from(await up.arrayBuffer());
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      return res.end(buf);

    } else if (provider === 'faceswap') {
      const { source, target_face } = JSON.parse(body || '{}');
      const up = await fetch('https://api.nudity.cloud/v1/swap', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: source,
          face: target_face,
          webhook: 'https://your-backend.com/faceswap-callback'
        })
      });
      const j = await up.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(j));

        } else if (provider === 'd-id') {
      /* D-ID Talks API */
      const { avatar_url, script, voice_id } = JSON.parse(body || '{}');
      const up = await fetch('https://api.d-id.com/talks', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source_url: avatar_url,
          script: {
            type: 'text',
            input: script,
            provider: { type: 'microsoft', voice_id: voice_id || 'en-US-JennyNeural' }
          },
          config: { stitch: true }
        })
      });
      const j = await up.json();
      res.writeHead(up.status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(j));

    } else if (provider === 'heygen') {
      /* HeyGen Video Agent v3 */
      const { script, avatar_id, voice_id, style_id } = JSON.parse(body || '{}');
      const up = await fetch('https://api.heygen.com/v3/video-agents', {
        method: 'POST',
        headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: script,
          mode: 'generate',
          avatar_id: avatar_id || undefined,
          voice_id: voice_id || undefined,
          style_id: style_id || undefined
        })
      });
      const j = await up.json();
      res.writeHead(up.status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(j));

    } else if (provider === 'synthesia') {
      /* Synthesia v2 videos */
      const { script, avatar_id, voice_id } = JSON.parse(body || '{}');
      const up = await fetch('https://api.synthesia.io/v2/videos', {
        method: 'POST',
        headers: { 'Authorization': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: false,
          input: [{
            avatar: avatar_id,
            script,
            background: '#0a1428'
          }],
          voice: voice_id
        })
      });
      const j = await up.json();
      res.writeHead(up.status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(j));

    } else {
      res.writeHead(400); return res.end('Unknown provider');
    }

    if (!upstream.ok){
      const err = await upstream.text();
      res.writeHead(upstream.status); return res.end(err);
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(200, { 'Content-Type': audioType });
    res.end(buf);
  } catch (e){
    res.writeHead(500); res.end('Proxy error: ' + e.message);
  }
});

server.listen(PORT, () => {
  console.log(`Studio X proxy listening on http://localhost:${PORT}`);
  console.log('POST /tts  { provider, text, voice, model }  header: x-api-key');
});