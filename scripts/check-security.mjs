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

const runNpm = (args) => process.env.npm_execpath
  ? run(process.execPath, [process.env.npm_execpath, ...args])
  : run('npm', args, { shell: process.platform === 'win32' });

const audit = (prefix, omitDev) => {
  const args = ['audit', '--json'];
  if (prefix) args.push('--prefix', prefix, '--workspaces=false');
  if (omitDev) args.push('--omit=dev');
  try {
    return JSON.parse(runNpm(args));
  } catch (error) {
    const output = error.stdout || error.stderr;
    if (!output) throw error;
    return JSON.parse(output);
  }
};

/**
 * Walks `via` chains to the advisory ids actually behind a finding.
 *
 * Only the originating package carries advisory objects; everything that merely
 * depends on it lists a package *name* instead. Without following those, a
 * transitive finding looks like it has no advisory at all.
 */
const resolveAdvisoryIds = (report, name, seen = new Set()) => {
  const ids = new Set();
  if (seen.has(name)) return ids;
  seen.add(name);
  for (const cause of report.vulnerabilities?.[name]?.via || []) {
    // Only high/critical advisories count. A package's finding is raised to
    // `high` by its worst advisory, but lower-severity ones ride along in the
    // same `via` list -- demanding entries for those would force moderate
    // advisories into a high allowlist, which is not what this check polices.
    if (typeof cause === 'object' && cause.source) {
      if (['high', 'critical'].includes(cause.severity)) ids.add(Number(cause.source));
    } else if (typeof cause === 'string') {
      for (const id of resolveAdvisoryIds(report, cause, seen)) ids.add(id);
    }
  }
  return ids;
};

/**
 * `allowedAdvisoryIds` excuses *documented* advisories only, and only ever for
 * the audit it is passed to. A finding is excused when every advisory reachable
 * from it is listed, so a new advisory riding along on an already-excused
 * package still fails the build. Criticals are never excusable.
 */
const assertNoSevere = (label, report, allowedAdvisoryIds = new Set()) => {
  const counts = report.metadata?.vulnerabilities || {};
  if ((counts.critical || 0) > 0) {
    failures.push(`${label} has ${counts.critical} critical findings.`);
    return;
  }
  const unexpected = Object.entries(report.vulnerabilities || {})
    .filter(([, finding]) => ['high', 'critical'].includes(finding.severity))
    .filter(([name]) => {
      const ids = [...resolveAdvisoryIds(report, name)];
      return ids.length === 0 || ids.some((id) => !allowedAdvisoryIds.has(id));
    })
    .map(([name]) => name);
  if (unexpected.length) {
    failures.push(`${label} has undocumented high findings: ${unexpected.join(', ')}.`);
  }
};

// Dev-only exceptions, applied solely to the complete audit below. The
// production audit is held at an absolute zero and takes no allowlist at all,
// because that is the set that actually ships.
const allowedRootDevAdvisories = new Set([
  // braces stack-exhaustion DoS via deeply nested patterns, reached through
  // micromatch / chokidar / fast-glob under `tailwindcss` and `nodemon`. Both
  // glob our own source paths at build and watch time and never see untrusted
  // input. npm's offered remedies are tailwindcss@4 -- a full config-pipeline
  // rewrite, not a security fix -- and a nodemon *downgrade* to 1.x. Same
  // advisory and same reasoning as the Mobile entry further down.
  1240992,
]);

assertNoSevere('Root/server production dependencies', audit('', true));
assertNoSevere('Root/server complete dependencies', audit('', false), allowedRootDevAdvisories);
assertNoSevere('Standalone API production dependencies', audit('server', true));

const mobile = audit('Mobile', false);
// Expo SDK 54's own build toolchain. Every entry here is reachable only from
// Metro/EAS tooling that runs on a developer machine or in CI -- none of it is
// in the shipped app bundle, and none of it is ever fed untrusted input. npm's
// only offered remedy for the whole group is `expo@44` / `react-native@0.72`,
// i.e. a semver-major *downgrade* that would break the Expo Go SDK 54 / RN 0.81
// compatibility set README.md explicitly forbids changing. Reassess with the
// next Expo SDK upgrade, not with `npm audit fix --force`.
const allowedMobilePackages = new Set([
  '@expo/cli', '@expo/code-signing-certificates', '@expo/metro', '@expo/metro-config',
  '@react-native-community/datetimepicker',
  '@react-native/community-cli-plugin', '@react-native/virtualized-lists',
  'braces', 'expo', 'image-size', 'metro', 'metro-config', 'metro-file-map',
  'metro-transform-worker', 'micromatch', 'node-forge', 'postcss', 'react-native',
]);
const allowedAdvisories = new Set([
  1117015,
  1124252,
  1124288,
  1130709,
  // PostCSS is bundled by Expo SDK 54's Metro toolchain. Resolving this
  // development-only source-map advisory requires an Expo SDK upgrade.
  1139510,
  1138808,
  1138809,
  // decode-uri-component, reached only through Expo's bundled `query-string`.
  // Moderate DoS on malformed percent-encoded input; npm offers no
  // non-breaking fix. Build tooling, not runtime app code -- the installed
  // app never feeds it untrusted input. Reassess with the Expo SDK upgrade.
  1147955,
  // node-forge RSA PKCS#1 v1.5 signature verification accepts extra nested
  // DigestAlgorithm elements. Reached only through
  // @expo/code-signing-certificates, which signs EAS Update manifests at build
  // time; the installed app never verifies attacker-supplied signatures with
  // it. Only fix on offer is the forbidden expo@44 downgrade.
  1240912,
  // braces stack-exhaustion DoS on deeply nested patterns, reached through
  // micromatch inside Metro's file map -- it matches our own glob patterns
  // against our own filenames during a build, never untrusted input.
  1240992,
]);
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

const trackedFiles = run('git', ['ls-files', '--cached', '--others', '--exclude-standard']).trim().split('\n').filter(Boolean);
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
    failures.push(`Possible messaging-service credential in ${file}.`);
  }
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) {
    failures.push(`Possible private key in ${file}.`);
  }
  if (/mongodb(?:\+srv)?:\/\/[^\s:@/]+:[^\s@/]+@/i.test(content)) {
    failures.push(`Possible credential-bearing MongoDB URI in ${file}.`);
  }
}

const trackedSource = sourceFiles.map((file) => `${file}\n${readFileSync(new URL(file, root), 'utf8')}`).join('\n');
if (/TWILIO_|api\.twilio\.com/i.test(trackedSource)) failures.push('Removed SMS-provider integration is still referenced.');
const securityTokenSources = sourceFiles.filter((file) =>
  /^server\/(?:controllers|lib)\//.test(file) && /(?:otp|auth|session|token|mfa)/i.test(file)
);
for (const file of securityTokenSources) {
  const content = readFileSync(new URL(file, root), 'utf8');
  if (/Math\.random\s*\(/.test(content)) failures.push(`Non-cryptographic security randomness in ${file}.`);
  if (/\b(?:otp|challenge)\w*Store\s*=\s*new Map\s*\(/i.test(content)) {
    failures.push(`Process-local OTP challenge storage in ${file}.`);
  }
}
const authMiddleware = readFileSync(new URL('server/middleware/auth.js', root), 'utf8');
if (!/if\s*\(!sessionId\)\s*\{[\s\S]{0,160}status\(401\)/.test(authMiddleware)) {
  failures.push('Authentication middleware does not reject sessionless access tokens.');
}

run(process.execPath, ['scripts/check-ui-security.mjs']);
run(process.execPath, [
  '--test',
  'server/tests/lib/phoneVerificationRestore.test.js',
  'server/tests/middleware/csrf.test.js',
]);

if (failures.length) {
  console.error('Security checks failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('Security checks passed.');
console.log('Root/server: no high or critical dependency findings.');
console.log('Mobile: only the documented Expo/Metro build-tool exceptions remain.');
