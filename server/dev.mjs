import { spawn } from 'node:child_process';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');

const apiServer = spawn(
  process.execPath,
  ['--no-warnings=ExperimentalWarning', path.join(rootDir, 'server', 'index.mjs')],
  {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, PORT: process.env.API_PORT || '3001' },
  }
);

const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const viteServer = spawn(process.execPath, [viteBin, '--port=3000', '--host=0.0.0.0'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

function shutdown() {
  apiServer.kill();
  viteServer.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
apiServer.on('exit', (code) => {
  if (code && code !== 0) {
    viteServer.kill();
    process.exit(code);
  }
});
viteServer.on('exit', (code) => {
  apiServer.kill();
  process.exit(code ?? 0);
});
