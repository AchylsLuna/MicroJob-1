'use strict';

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

if (process.env.SKIP_NODE_CHECK === '1') {
  process.exit(0);
}

if (isLessThan(current, required)) {
  const requiredVersion = required.join('.');
  const currentVersion = process.versions.node;
  console.error(`\nNode.js ${requiredVersion}+ is required. You are using ${currentVersion}.`);
  console.error('Fix:');
  console.error('  nvm use 22.12.0');
  console.error('  # or install it: nvm install 22.12.0');
  console.error('If you already have it installed, run: nvm use');
  console.error('');
  process.exit(1);
}
