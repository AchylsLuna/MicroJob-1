#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const mobileRoot = path.resolve(__dirname, '..');
const sourceRoots = ['app.jsx', 'components', 'contexts', 'lib', 'pages'];
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const bannedPrimaryColors = /#(?:2563eb|1d4ed8|0a2847|4a90e2|1b4fd8|1e3a5f)\b/i;
const disabledFontScaling = /allowFontScaling\s*=\s*\{false\}/;
const failures = [];
let checkedFiles = 0;

function visit(target) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) visit(path.join(target, entry));
    return;
  }

  if (!sourceExtensions.has(path.extname(target))) return;
  checkedFiles += 1;
  const source = fs.readFileSync(target, 'utf8');
  const relative = path.relative(mobileRoot, target);

  if (bannedPrimaryColors.test(source)) failures.push(`${relative}: uses an alternate primary blue/navy`);
  if (disabledFontScaling.test(source)) failures.push(`${relative}: disables accessibility font scaling`);
  if (source.includes('StyleSheet.create') && !/tokens|AUTH_COLORS/.test(source)) {
    failures.push(`${relative}: defines styles without the canonical mobile theme`);
  }
}

for (const sourceRoot of sourceRoots) visit(path.join(mobileRoot, sourceRoot));

if (failures.length) {
  console.error(`Mobile theme check failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  process.exit(1);
}

console.log(`Mobile theme checks passed across ${checkedFiles} source files.`);
