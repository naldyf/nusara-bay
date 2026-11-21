// A tiny static server for game/ (Node 22, standard library only), so an
// entry can be played locally without a build step:
//
//   node serve.ts               serves game/ on http://localhost:8080
//   node serve.ts --port 8092   serves it on another port instead
//
// It sends the MIME types a browser game needs, refuses any path outside
// game/, and otherwise does nothing clever: this is a development
// convenience, not a web server for the internet.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function mimeFor(path) {
  const byExt = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.gif', 'image/gif'],
    ['.webp', 'image/webp'],
    ['.svg', 'image/svg+xml'],
    ['.ico', 'image/x-icon'],
    ['.woff2', 'font/woff2'],
    ['.glb', 'model/gltf-binary'],
    ['.gltf', 'model/gltf+json'],
    ['.bin', 'application/octet-stream'],
    ['.wasm', 'application/wasm'],
    ['.wav', 'audio/wav'],
    ['.mp3', 'audio/mpeg'],
    ['.ogg', 'audio/ogg'],
    ['.txt', 'text/plain; charset=utf-8'],
  ]);
  return byExt.get(extname(path).toLowerCase()) ?? 'application/octet-stream';
}

function pickPort(argv) {
  const flag = argv.indexOf('--port');
  const asked = flag === -1 ? 8080 : Number(argv[flag + 1]);
  return Number.isInteger(asked) && asked > 0 && asked < 65536 ? asked : 8080;
}

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));

// Fail loudly at startup if game/ is missing, instead of answering 404 to
// every request and looking like a broken server.
if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error(`game/ not found at ${root} — run from the repository root`);
  process.exit(1);
}

const port = pickPort(process.argv.slice(2));

function serveFile(request, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(root, normalize(pathname)));
  // Never serve anything outside game/, however the path is spelled.
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  let size;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': mimeFor(file),
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}

createServer(serveFile).listen(port, '127.0.0.1', () => {
  console.log(`game/ is on http://localhost:${port}`);
});
