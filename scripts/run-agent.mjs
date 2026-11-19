import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const python = resolve(
  'backend/local-agent/.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
const child = spawn(python, ['-m', 'corewise_runner', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, PYTHONPATH: resolve('backend/local-agent') },
});
child.on('error', (e) => {
  console.error(e.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
