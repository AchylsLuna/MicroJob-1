import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const failures = [];

const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  ...options,
});

const audit = (prefix, omitDev) => {
  const args = ['audit', '--json'];
  if (prefix) args.push('--prefix', prefix);
  if (omitDev) args.push('--omit=dev');
  try {
    return JSON.parse(run('npm', args));
  } catch (error) {
    const output = error.stdout || error.stderr;
    if (!output) throw error;
    return JSON.parse(output);
  }
};

const assertNoSevere = (label, report) => {
  const counts = report.metadata?.vulnerabilities || {};
  if ((counts.critical || 0) + (counts.high || 0) > 0) {
    failures.push(`${label} has ${counts.critical || 0} critical and ${counts.high || 0} high findings.`);
  }
};

assertNoSevere('Root/server production dependencies', audit('', true));
assertNoSevere('Root/server complete dependencies', audit('', false));

const mobile = audit('Mobile', false);
const allowedMobilePackages = new Set([
  '@expo/cli', '@expo/metro', '@expo/metro-config',
  '@react-native/community-cli-plugin', '@react-native/virtualized-lists',
  'expo', 'image-size', 'metro', 'metro-config', 'metro-transform-worker', 'react-native',
]);
const allowedAdvisories = new Set([1138808, 1138809]);
const mobileFindings = Object.entries(mobile.vulnerabilities || {});
const unexpectedPackages = mobileFindings
  .filter(([name, finding]) => ['high', 'critical'].includes(finding.severity) && !allowedMobilePackages.has(name))
  .map(([name]) => name);
const advisoryIds = new Set();
for (const [, finding] of mobileFindings) {
  for (const cause of finding.via || []) {
    if (typeof cause === 'object' && cause.source) advisoryIds.add(Number(cause.source));
  }
}
const unexpectedAdvisories = [...advisoryIds].filter((id) => !allowedAdvisories.has(id));
if (unexpectedPackages.length || unexpectedAdvisories.length || (mobile.metadata?.vulnerabilities?.critical || 0) > 0) {
  failures.push(`Mobile has unapproved severe findings (packages: ${unexpectedPackages.join(', ') || 'none'}; advisories: ${unexpectedAdvisories.join(', ') || 'none'}).`);
}

const trackedFiles = run('git', ['ls-files']).trim().split('\n').filter(Boolean);
const forbiddenTrackedFiles = trackedFiles.filter((file) => /(^|\/)\.env($|\.)/.test(file) && !file.endsWith('.env.example'));
if (forbiddenTrackedFiles.length) failures.push(`Tracked environment files: ${forbiddenTrackedFiles.join(', ')}`);

const sourceFiles = trackedFiles.filter((file) =>
  /^(server|client\/src|Mobile)\//.test(file)
  && !/^server\/tests\//.test(file)
  && /\.(?:[cm]?[jt]sx?|json|ya?ml|env\.example)$/.test(file)
  && existsSync(new URL(file, root))
);
for (const file of sourceFiles) {
  const content = readFileSync(new URL(file, root), 'utf8');
  if (/AC[a-f0-9]{32}/i.test(content) || /SK[a-f0-9]{32}/i.test(content)) {
    failures.push(`Possible Twilio credential in ${file}.`);
  }
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) {
    failures.push(`Possible private key in ${file}.`);
  }
  if (/mongodb(?:\+srv)?:\/\/[^\s:@/]+:[^\s@/]+@/i.test(content)) {
    failures.push(`Possible credential-bearing MongoDB URI in ${file}.`);
  }
}

const trackedSource = sourceFiles.map((file) => `${file}\n${readFileSync(new URL(file, root), 'utf8')}`).join('\n');
if (/\/api\/verify-phone/i.test(trackedSource)) failures.push('Legacy /api/verify-phone route is still referenced.');
if (/PhoneVerification\.js|model\(['"]PhoneVerification/i.test(trackedSource)) failures.push('Plaintext legacy PhoneVerification storage is still referenced.');
if (/TEXTBEE_/i.test(trackedSource)) failures.push('Obsolete TextBee configuration is still referenced.');

run(process.execPath, ['scripts/check-ui-security.mjs']);
run(process.execPath, [
  '--test',
  'server/tests/lib/phoneOtp.test.js',
  'server/tests/lib/legacyPhoneRouteRemoval.test.js',
  'server/tests/middleware/csrf.test.js',
]);

if (failures.length) {
  console.error('Security checks failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('Security checks passed.');
console.log('Root/server: no high or critical dependency findings.');
console.log('Mobile: only the documented Expo/Metro image-size build-tool exception remains.');
