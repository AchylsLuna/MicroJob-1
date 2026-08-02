import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'android') continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute));
    else if (sourceExtensions.has(extname(entry.name))) files.push(absolute);
  }
  return files;
}

const findings = [];
const files = [...await collectFiles(join(root, 'client', 'src')), ...await collectFiles(join(root, 'Mobile'))];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const name = relative(root, file).replaceAll('\\', '/');
  if (name !== 'Mobile/lib/storage.ts' && source.includes("@react-native-async-storage/async-storage")) {
    findings.push(`${name}: bypasses the secure mobile storage adapter`);
  }
  if (name.startsWith('client/src/') && /window\.(confirm|prompt|alert)\s*\(/.test(source)) {
    findings.push(`${name}: uses a browser-native confirmation/prompt`);
  }
  if (/["'`]\s*(javascript|data):/i.test(source) && !name.endsWith('safeExternalUrl.ts')) {
    findings.push(`${name}: contains a potentially unsafe external URL protocol`);
  }
}

if (findings.length) {
  console.error(`UI security checks failed:\n${findings.map((item) => `- ${item}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`UI security checks passed across ${files.length} source files.`);
}
