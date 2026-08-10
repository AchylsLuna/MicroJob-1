const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const sourceRoots = ['components', 'contexts', 'hooks', 'pages', 'theme'];
const findings = [];

function visit(relativePath) {
  const absolutePath = path.join(mobileRoot, relativePath);
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) visit(child);
    else if (/\.(?:js|jsx|ts|tsx)$/.test(entry.name)) inspect(child);
  }
}

function inspect(relativePath) {
  const source = fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');
  if (/useNativeDriver\s*:\s*false/.test(source)) {
    findings.push(`${relativePath}: transform/opacity animations must stay on the native driver`);
  }
}

for (const root of sourceRoots) visit(root);

const virtualizedScreens = [
  'pages/pages1/AppliedJobs.tsx',
  'pages/pages1/SavedJobs.tsx',
  'pages/employer/EmployerJobPosts.tsx',
];

for (const relativePath of virtualizedScreens) {
  const source = fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');
  if (!/<FlatList/.test(source)) findings.push(`${relativePath}: long collection must remain virtualized`);
}

if (findings.length) {
  console.error(`Motion/performance checks failed:\n- ${findings.join('\n- ')}`);
  process.exit(1);
}

console.log('Motion/performance checks passed.');
