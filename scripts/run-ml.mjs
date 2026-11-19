import './runtime-environment.mjs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const python = resolve(
  'backend/ml/.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
const mode = process.argv[2];
const args =
  mode === 'worker'
    ? ['-m', 'corewise_ml.worker']
    : ['-m', 'uvicorn', 'corewise_ml.app:app', '--host', '127.0.0.1', '--port', '8000'];
const child = spawn(python, args, {
  stdio: 'inherit',
  env: { ...process.env, PYTHONPATH: resolve('backend/ml') },
});
child.on('error', (err) => {
  console.error(err.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
