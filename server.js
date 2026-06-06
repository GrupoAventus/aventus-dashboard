const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || '';

http.createServer((req, res) => {
  let filePath = path.join(__dirname, 'index.html');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Erro ao carregar o arquivo');
      return;
    }

    // Injeta a chave de API de forma segura
    data = data.replace(
      "const ANTHROPIC_KEY = window.ANTHROPIC_KEY || '';",
      `const ANTHROPIC_KEY = '${ANTHROPIC_KEY}';`
    );

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
