#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const mobileRoot = path.resolve(__dirname, '..');
const sourceRoots = ['app.jsx', 'components', 'contexts', 'lib', 'pages'];
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const bannedPrimaryColors = /#(?:2563eb|1d4ed8|0a2847|4a90e2|1b4fd8|1e3a5f)\b/i;
const bannedCanvasColors = /backgroundColor\s*:\s*["']#(?:f5f7fa|f8fafc)["']/i;
const legacySignedInCanvas = /(?:container|screen)\s*:\s*\{[^}]*backgroundColor\s*:\s*["']#(?:1c4d8d|0f2954)["']/is;
const disabledFontScaling = /allowFontScaling\s*=\s*\{false\}/;

// Hardcoded colour literals bypass theme/tokens.ts. There is a large existing
// backlog, so this is a ratchet rather than a hard ban: the count may fall, and
// must never rise. Lower HEX_LITERAL_BUDGET whenever you clear some out.
const hexLiteral = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const HEX_LITERAL_BUDGET = 552;
const hexCountsByFile = new Map();

const failures = [];
let checkedFiles = 0;
let hexLiteralCount = 0;

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
  if (bannedCanvasColors.test(source) && /(?:container|screen)\s*:\s*\{[^}]*backgroundColor\s*:\s*["']#(?:f5f7fa|f8fafc)["']/is.test(source)) {
    failures.push(`${relative}: uses a hard-coded light page canvas; use the appropriate semantic canvas token`);
  }
  if (legacySignedInCanvas.test(source)) failures.push(`${relative}: uses a legacy hard-coded blue page canvas; use tokens.colors.signedInCanvas`);
  if (disabledFontScaling.test(source)) failures.push(`${relative}: disables accessibility font scaling`);
  if (source.includes('StyleSheet.create') && !/tokens|AUTH_COLORS/.test(source)) {
    failures.push(`${relative}: defines styles without the canonical mobile theme`);
  }

  const hexMatches = source.match(hexLiteral);
  if (hexMatches) {
    hexLiteralCount += hexMatches.length;
    hexCountsByFile.set(relative, hexMatches.length);
  }
}

for (const sourceRoot of sourceRoots) visit(path.join(mobileRoot, sourceRoot));

if (hexLiteralCount > HEX_LITERAL_BUDGET) {
  const worst = [...hexCountsByFile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([file, count]) => `- ${file} (${count})`)
    .join('\n');
  failures.push(
    `hardcoded colour literals rose to ${hexLiteralCount}, above the budget of ${HEX_LITERAL_BUDGET}.\n` +
      `  Use theme/tokens.ts instead of a raw hex value. Files with the most:\n${worst.replace(/^/gm, '  ')}`,
  );
}

if (failures.length) {
  console.error(`Mobile theme check failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  process.exit(1);
}

const headroom = HEX_LITERAL_BUDGET - hexLiteralCount;
console.log(
  `Mobile theme checks passed across ${checkedFiles} source files ` +
    `(${hexLiteralCount} hardcoded colour literals, budget ${HEX_LITERAL_BUDGET}` +
    `${headroom > 0 ? ` — lower HEX_LITERAL_BUDGET to ${hexLiteralCount}` : ''}).`,
);
