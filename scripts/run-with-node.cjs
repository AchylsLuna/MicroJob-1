'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const required = [22, 12, 0];
const current = process.versions.node.split('.').map((part) => Number(part));

const isLessThan = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
};

const shellQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node run-with-node.cjs <command> [args...]');
  process.exit(1);
}

const command = args[0];
const commandArgs = args.slice(1);

const runDirect = () => {
  const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code ?? 1));
};

if (!isLessThan(current, required)) {
  runDirect();
  return;
}

if (process.platform === 'win32') {
  const requiredVersion = required.join('.');
  console.error(`\nNode.js ${requiredVersion}+ is required. You are using ${process.versions.node}.`);
  console.error('Fix: install Node 22.12.0+ and re-run the command.');
  process.exit(1);
}

const nvmDir = process.env.NVM_DIR || path.join(os.homedir(), '.nvm');
const nvmSh = path.join(nvmDir, 'nvm.sh');

if (!fs.existsSync(nvmSh)) {
  const requiredVersion = required.join('.');
  console.error(`\nNode.js ${requiredVersion}+ is required. You are using ${process.versions.node}.`);
  console.error('nvm was not found. Install Node 22.12.0+ or install nvm and run:');
  console.error('  nvm install 22.12.0');
  console.error('  nvm use 22.12.0');
  process.exit(1);
}

const commandString = [command, ...commandArgs].map(shellQuote).join(' ');
const bashCommand = [
  'unset npm_config_prefix',
  'unset NPM_CONFIG_PREFIX',
  `export NVM_DIR=${shellQuote(nvmDir)}`,
  '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"',
  'nvm use 22.12.0 >/dev/null',
  commandString,
].join(' && ');

const child = spawn('bash', ['-lc', bashCommand], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 1));
