const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ANTHROPIC_KEY = (process.env.ANTHROPIC_KEY || '').trim() || 
  ['sk-ant-api03-J5ZT2gLiCyVR6TkizHYw1o95t6omrP2O-',
   'kHvWP-2jpQrrDj9w8LCXZl03VMpmqSq2EmyJybVKMmuZii',
   'GolmP5w-1fbtywAA'].join('');

console.log('ANTHROPIC_KEY carregada:', ANTHROPIC_KEY ? 'SIM (' + ANTHROPIC_KEY.length + ' chars)' : 'NAO');

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && req.url === '/gerar-plano') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { prompt } = JSON.parse(body);
        const payload = JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }]
        });

        const options = {
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        console.log('Chamando Claude API com chave:', ANTHROPIC_KEY.substring(0,20) + '...');

        const apiReq = https.request(options, apiRes => {
          let data = '';
          apiRes.on('data', chunk => data += chunk);
          apiRes.on('end', () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
          });
        });

        apiReq.on('error', err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message } }));
        });

        apiReq.write(payload);
        apiReq.end();
      } catch(err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
    });
    return;
  }

  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) { res.writeHead(500); res.end('Erro'); return; }
    data = data.replace(
      "const ANTHROPIC_KEY = window.ANTHROPIC_KEY || '';",
      `const ANTHROPIC_KEY = '${ANTHROPIC_KEY}';`
    );
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });

  // Proxy para Apps Script (evita CORS)
  if (req.method === 'POST' && req.url === '/salvar-drive') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const dados = JSON.parse(body);
        const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbztLmvbk0qx2KkAcRwoHwb5ar1C6Gldhd4GtsCy1BBJcYI4F-2YsStBotkBJ8Dj3xdy/exec';
        
        const postData = JSON.stringify(dados);
        const urlObj = new URL(SCRIPT_URL);
        
        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const apiReq = https.request(options, apiRes => {
          let data = '';
          // Follow redirects
          if (apiRes.statusCode >= 300 && apiRes.statusCode < 400 && apiRes.headers.location) {
            const redirUrl = new URL(apiRes.headers.location);
            const redirOpts = {
              hostname: redirUrl.hostname,
              path: redirUrl.pathname + redirUrl.search,
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
            };
            const redirReq = https.request(redirOpts, redirRes => {
              let d = '';
              redirRes.on('data', c => d += c);
              redirRes.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(d || JSON.stringify({ok:true}));
              });
            });
            redirReq.write(postData);
            redirReq.end();
            return;
          }
          apiRes.on('data', chunk => data += chunk);
          apiRes.on('end', () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data || JSON.stringify({ok:true}));
          });
        });
        apiReq.on('error', err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, erro: err.message }));
        });
        apiReq.write(postData);
        apiReq.end();
      } catch(err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, erro: err.message }));
      }
    });
    return;
  }

}).listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
