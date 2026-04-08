#!/usr/bin/env node
/**
 * clawmander CLI — single entry point for the npm-installed dashboard.
 *
 * Spawns the backend (Express + WS on port 3001 by default) and the
 * frontend (Next.js prebuilt static server on port 3000 by default),
 * and routes persistent storage to ~/.clawmander so user data survives
 * package upgrades.
 *
 * Subcommands:
 *   clawmander start [--backend-port N] [--frontend-port N] [--data-dir PATH]
 *   clawmander stop
 *   clawmander status
 *   clawmander --help
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const PKG_ROOT = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(PKG_ROOT, 'backend');
const FRONTEND_DIR = path.join(PKG_ROOT, 'frontend');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function resolveDataDir(args) {
  return (
    args['data-dir'] ||
    process.env.CLAWMANDER_DATA_DIR ||
    path.join(os.homedir(), '.clawmander', 'data')
  );
}

function pidfilePath(dataDir) {
  return path.join(dataDir, 'clawmander.pid');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function help() {
  console.log(`clawmander — personal command center dashboard

Usage:
  clawmander start [options]   Start backend + frontend
  clawmander stop              Stop running services
  clawmander status            Show whether services are running

Options:
  --backend-port N    Backend port (default 3001)
  --frontend-port N   Frontend port (default 3000)
  --data-dir PATH     Data directory (default ~/.clawmander/data)
  --help              Show this help

Environment:
  CLAWMANDER_DATA_DIR   Override data directory
  OPENCLAW_WS_URL       OpenClaw gateway WebSocket URL (default ws://127.0.0.1:18789)
  OPENCLAW_TOKEN        OpenClaw gateway auth token
  JWT_SECRET            JWT signing secret (CHANGE IN PRODUCTION)
  JWT_REFRESH_SECRET    JWT refresh token signing secret
`);
}

function start(args) {
  const dataDir = resolveDataDir(args);
  ensureDir(dataDir);

  const backendPort = args['backend-port'] || process.env.PORT || '3001';
  const frontendPort = args['frontend-port'] || '3000';

  const env = {
    ...process.env,
    CLAWMANDER_DATA_DIR: dataDir,
    PORT: backendPort,
    NODE_ENV: 'production',
  };

  console.log(`[clawmander] data dir: ${dataDir}`);
  console.log(`[clawmander] backend  port: ${backendPort}`);
  console.log(`[clawmander] frontend port: ${frontendPort}`);

  const backend = spawn(process.execPath, ['server.js'], {
    cwd: BACKEND_DIR,
    env,
    stdio: 'inherit',
  });

  // Frontend uses its own server.js which proxies WS upgrades to backend on
  // 127.0.0.1:3001 (currently hardcoded). When the user picks a different
  // backend port we tell the frontend via env so it can reach it.
  const frontendEnv = {
    ...env,
    PORT: frontendPort,
    BACKEND_PORT: backendPort,
  };

  const frontend = spawn(process.execPath, ['server.js'], {
    cwd: FRONTEND_DIR,
    env: frontendEnv,
    stdio: 'inherit',
  });

  // Write pidfile so `clawmander stop` can find them
  fs.writeFileSync(
    pidfilePath(dataDir),
    JSON.stringify({ backend: backend.pid, frontend: frontend.pid }, null, 2)
  );

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[clawmander] received ${signal}, stopping...`);
    try { backend.kill('SIGTERM'); } catch {}
    try { frontend.kill('SIGTERM'); } catch {}
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  const onExit = (name) => (code) => {
    console.log(`[clawmander] ${name} exited with code ${code}`);
    shutdown(`${name}-exit`);
  };
  backend.on('exit', onExit('backend'));
  frontend.on('exit', onExit('frontend'));
}

function stop(args) {
  const dataDir = resolveDataDir(args);
  const pidfile = pidfilePath(dataDir);
  if (!fs.existsSync(pidfile)) {
    console.log('[clawmander] no pidfile found — nothing to stop');
    return;
  }
  const { backend, frontend } = JSON.parse(fs.readFileSync(pidfile, 'utf8'));
  for (const [name, pid] of [['backend', backend], ['frontend', frontend]]) {
    if (!pid) continue;
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`[clawmander] sent SIGTERM to ${name} (pid ${pid})`);
    } catch (err) {
      console.log(`[clawmander] ${name} (pid ${pid}) not running`);
    }
  }
  fs.unlinkSync(pidfile);
}

function status(args) {
  const dataDir = resolveDataDir(args);
  const pidfile = pidfilePath(dataDir);
  if (!fs.existsSync(pidfile)) {
    console.log('[clawmander] not running');
    process.exit(1);
  }
  const { backend, frontend } = JSON.parse(fs.readFileSync(pidfile, 'utf8'));
  const alive = (pid) => {
    if (!pid) return false;
    try { process.kill(pid, 0); return true; } catch { return false; }
  };
  console.log(`backend  (pid ${backend}):  ${alive(backend) ? 'running' : 'not running'}`);
  console.log(`frontend (pid ${frontend}): ${alive(frontend) ? 'running' : 'not running'}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length === 0) return help();
  const cmd = args._[0];
  switch (cmd) {
    case 'start': return start(args);
    case 'stop': return stop(args);
    case 'status': return status(args);
    default:
      console.error(`unknown command: ${cmd}`);
      help();
      process.exit(1);
  }
}

main();
