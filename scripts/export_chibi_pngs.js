const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3589;
const htmlPath = path.join(__dirname, 'render_chibi.html');
const outBaseDir = path.join(__dirname, '../public/assets/characters');

let savedCount = 0;
const expectedCount = 28;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/render_chibi.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(htmlPath, 'utf8'));
    return;
  }

  if (req.method === 'GET' && req.url === '/js/human_sprites.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, '../public/js/human_sprites.js'), 'utf8'));
    return;
  }

  if (req.method === 'POST' && req.url === '/save-frame') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { character, frame, dataUrl } = JSON.parse(body);
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        const targetDir = path.join(outBaseDir, character);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        const targetFile = path.join(targetDir, `${frame}.png`);
        fs.writeFileSync(targetFile, Buffer.from(base64Data, 'base64'));
        savedCount++;
        console.log(`[${savedCount}/${expectedCount}] Saved: ${character}/${frame}.png (${Math.round(base64Data.length * 0.75 / 1024)} KB)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        console.error('Save error:', err);
        res.writeHead(500);
        res.end(err.message);
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/done') {
    console.log('Rendering complete signal received from browser!');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    setTimeout(() => {
      cleanupAndExit(0);
    }, 500);
    return;
  }

  res.writeHead(404);
  res.end();
});

let browserProcess = null;

function cleanupAndExit(code = 0) {
  if (browserProcess) {
    try {
      browserProcess.kill();
    } catch (e) {}
  }
  server.close(() => {
    console.log(`Export server stopped. Total frames exported: ${savedCount}/${expectedCount}.`);
    process.exit(code);
  });
}

server.listen(PORT, () => {
  console.log(`Export server listening on port ${PORT}...`);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const bin = fs.existsSync(edgePath) ? edgePath : chromePath;

  console.log(`Launching headless browser: ${bin}`);
  browserProcess = spawn(bin, [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${PORT}/render_chibi.html`
  ]);

  browserProcess.on('error', err => {
    console.error('Failed to start browser:', err);
    cleanupAndExit(1);
  });

  setTimeout(() => {
    console.warn('Timed out waiting for browser completion. Cleaning up...');
    cleanupAndExit(savedCount === expectedCount ? 0 : 1);
  }, 20000);
});
