const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ANTHROPIC_KEY = (process.env.ANTHROPIC_KEY || '').trim() || 
  ['sk-ant-api03-J5ZT2gLiCyVR6TkizHYw1o95t6omrP2O-',
   'kHvWP-2jpQrrDj9w8LCXZl03VMpmqSq2EmyJybVKMmuZii',
   'GolmP5w-1fbtywAA'].join('');

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbztLmvbk0qx2KkAcRwoHwb5ar1C6Gldhd4GtsCy1BBJcYI4F-2YsStBotkBJ8Dj3xdy/exec';

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const follow = (u, redirects) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      https.get(u, res => {
        if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
          return follow(res.headers.location, redirects + 1);
        }
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    };
    follow(url, 0);
  });
}

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const follow = (u, b, redirects) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      const parsed = new URL(u);
      const opts = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(b)
        }
      };
      const req = https.request(opts, res => {
        if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
          // For redirects after POST, use GET
          return httpsGet(res.headers.location).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.write(b);
      req.end();
    };
    follow(url, body, 0);
  });
}

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Proxy GET to Sheets
  if (req.method === 'GET' && req.url.startsWith('/sheets')) {
    try {
      const params = req.url.replace('/sheets', '');
      const data = await httpsGet(SCRIPT_URL + params);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch(err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Proxy POST to Sheets
  if (req.method === 'POST' && req.url === '/sheets') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = await httpsPost(SCRIPT_URL, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data || JSON.stringify({ ok: true }));
      } catch(err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Claude API proxy
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
        const opts = {
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
        const apiReq = https.request(opts, apiRes => {
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

  // Serve index.html
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) { res.writeHead(500); res.end('Erro'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });

}).listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
