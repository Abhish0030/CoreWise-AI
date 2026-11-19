import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import service from './service.mjs';
import {
  DEVICES,
  KINDS,
  efficiencyByKindAndDevice,
  ensureSeed,
  runAgent,
  type WorkloadKind,
} from './predictor.mjs';

// The service declaration is the only doorway: database and port come from
// the service node, never from process.env.
const { db } = service.load();
const port = service.port();

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isWorkloadKind(value: string): value is WorkloadKind {
  return (KINDS as readonly string[]).includes(value);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8');
      if (body.length > 16_384) {
        reject(new Error('request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function parseForm(body: string): URLSearchParams {
  return new URLSearchParams(body);
}

function deviceBadge(device: string): string {
  return `<span class="badge ${esc(device)}">${esc(device.toUpperCase())}</span>`;
}

function efficiencyChart(averages: Map<string, number>): string {
  const rows = KINDS.map((kind) => {
    const bars = DEVICES.map((device) => {
      const value = averages.get(`${kind}:${device}`) ?? 0;
      const pct = Math.round(value * 234);
      return `<g transform="translate(0,${device === 'cpu' ? 0 : 18})">
        <rect x="150" y="4" width="${pct}" height="12" rx="3" class="bar ${device}"></rect>
        <text x="150" y="14" class="barlabel" dx="${pct + 8}">${(value * 100).toFixed(1)}%</text>
        <text x="142" y="14" text-anchor="end" class="rowlabel">${device}</text>
      </g>`;
    }).join('');
    return `<g transform="translate(0,${(KINDS.indexOf(kind) * 48 + 10).toString()})">
      <text x="0" y="10" class="kindlabel">${esc(kind)}</text>
      ${bars}
    </g>`;
  }).join('');
  const height = KINDS.length * 48 + 24;
  return `<svg viewBox="0 0 400 ${height}" width="100%" role="img" aria-label="Average measured efficiency of each workload kind per processing unit">${rows}</svg>`;
}

async function renderDashboard(): Promise<string> {
  const [predictions, averages, benchmarks] = await Promise.all([
    db.client.orm.public.Prediction.orderBy((p) => p.createdAt.desc()).limit(10).all(),
    efficiencyByKindAndDevice(db),
    db.client.orm.public.Benchmark.all(),
  ]);

  const predictionRows = predictions
    .map(
      (p) => `<tr>
        <td>${esc(p.workload)}</td>
        <td>${esc(p.kind)}</td>
        <td>${p.matrixSize}</td>
        <td>${p.threads}</td>
        <td>${deviceBadge(p.recommendedDevice)}</td>
        <td>${p.predictedDurationMs.toFixed(1)} ms</td>
        <td>${(p.confidence * 100).toFixed(0)}%</td>
        <td><time>${esc(p.createdAt.toISOString())}</time></td>
      </tr>`,
    )
    .join('\n');

  const kindOptions = KINDS.map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join('');
  const latest = predictions[0];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CoreWise-AI — CPU/GPU workload predictor</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b1020; color: #e6ebff; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 980px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.02em; }
  h1 .accent { color: #7c9cff; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.08em; color: #93a0c4; margin: 36px 0 12px; }
  .tagline { color: #93a0c4; margin: 0 0 8px; }
  .card { background: #121a33; border: 1px solid #223059; border-radius: 12px; padding: 18px 20px; }
  form { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 10px; align-items: end; }
  label { display: block; font-size: 12px; color: #93a0c4; margin-bottom: 4px; }
  input, select { width: 100%; background: #0b1020; color: #e6ebff; border: 1px solid #2c3c6e; border-radius: 8px; padding: 9px 10px; font: inherit; }
  button { background: #4f6ef7; color: white; border: 0; border-radius: 8px; padding: 10px 18px; font: inherit; font-weight: 600; cursor: pointer; }
  button:hover { background: #6a83f8; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; color: #93a0c4; font-weight: 600; padding: 8px 10px; border-bottom: 1px solid #223059; }
  td { padding: 8px 10px; border-bottom: 1px solid #1a2547; }
  time { color: #93a0c4; font-size: 12px; }
  .badge { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 700; }
  .badge.cpu { background: #1d3a2a; color: #5fd39a; }
  .badge.gpu { background: #3a2a1d; color: #ffb45f; }
  svg text { fill: #93a0c4; font-size: 11px; }
  svg .kindlabel { fill: #e6ebff; font-size: 13px; font-weight: 600; }
  svg .bar.cpu { fill: #5fd39a; }
  svg .bar.gpu { fill: #ffb45f; }
  .muted { color: #93a0c4; font-size: 13px; }
  .reasoning { white-space: pre-line; color: #b9c3e0; font-size: 13px; margin: 8px 0 0; }
  .latest { border-color: #4f6ef7; }
  footer { margin-top: 40px; color: #5d6a92; font-size: 12px; }
</style>
</head>
<body>
<main>
  <h1>Core<span class="accent">Wise</span>-AI</h1>
  <p class="tagline">AI-powered CPU-GPU workload predictor — estimates execution performance, recommends a processing unit, and visualizes workload efficiency.</p>

  <h2>Predict a workload</h2>
  <div class="card">
    <form method="post" action="/predict">
      <div><label for="workload">Workload name</label><input id="workload" name="workload" required maxlength="80" placeholder="resnet50-fwd"></div>
      <div><label for="kind">Kind</label><select id="kind" name="kind">${kindOptions}</select></div>
      <div><label for="matrixSize">Size</label><input id="matrixSize" name="matrixSize" type="number" min="1" max="1000000000" required value="2048"></div>
      <div><label for="threads">Threads</label><input id="threads" name="threads" type="number" min="1" max="1024" required value="16"></div>
      <div><button type="submit">Predict</button></div>
    </form>
  </div>
${
  latest
    ? `  <h2>Latest recommendation</h2>
  <div class="card latest">
    <strong>${esc(latest.workload)}</strong> (${esc(latest.kind)}, size ${latest.matrixSize}, ${latest.threads} threads)
    → run on ${deviceBadge(latest.recommendedDevice)} in ≈ ${latest.predictedDurationMs.toFixed(1)} ms
    <span class="muted">(${(latest.confidence * 100).toFixed(0)}% confidence)</span>
    <p class="reasoning">${esc(latest.reasoning)}</p>
  </div>`
    : ''
}
  <h2>Workload efficiency by processing unit</h2>
  <div class="card">${efficiencyChart(averages)}</div>
  <p class="muted">Average share of peak throughput reached across ${benchmarks.length} recorded benchmark runs.</p>

  <h2>Recent predictions</h2>
  <div class="card">
    <table>
      <thead><tr><th>Workload</th><th>Kind</th><th>Size</th><th>Threads</th><th>Unit</th><th>Predicted</th><th>Confidence</th><th>When</th></tr></thead>
      <tbody>${predictionRows || '<tr><td colspan="8" class="muted">No predictions yet — submit a workload above.</td></tr>'}</tbody>
    </table>
  </div>

  <footer>CoreWise-AI · Prisma ORM 8 on Prisma Compute</footer>
</main>
</body>
</html>`;
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await renderDashboard());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/predict') {
    const form = parseForm(await readBody(req));
    const workload = (form.get('workload') ?? '').trim();
    const kind = form.get('kind') ?? '';
    const matrixSize = Number(form.get('matrixSize'));
    const threads = Number(form.get('threads'));
    if (workload.length === 0 || workload.length > 80 || !isWorkloadKind(kind) || !Number.isInteger(matrixSize) || matrixSize < 1 || matrixSize > 1_000_000_000 || !Number.isInteger(threads) || threads < 1 || threads > 1024) {
      res.writeHead(422, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html lang="en"><body><h1>Invalid workload</h1><p><a href="/">Back to CoreWise-AI</a></p></body></html>');
      return;
    }
    await runAgent(db, { workload, kind, matrixSize, threads });
    res.writeHead(303, { location: '/' });
    res.end();
    return;
  }

  res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><html lang="en"><body><h1>404</h1><p><a href="/">Back to CoreWise-AI</a></p></body></html>');
}

try {
  const seeded = await ensureSeed(db);
  console.log(`[corewise-ai] benchmark store ready (${seeded} runs).`);
} catch (error) {
  // Keep serving: the dashboard reports the failure, and a restart can retry.
  console.error('[corewise-ai] failed to prepare the benchmark store', error);
}

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error('[corewise-ai] request failed', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' });
    }
    res.end('<!doctype html><html lang="en"><body><h1>Something went wrong</h1><p><a href="/">Back to CoreWise-AI</a></p></body></html>');
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[corewise-ai] listening on http://0.0.0.0:${port}`);
});
