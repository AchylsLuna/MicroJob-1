'use strict';

const requiredModules = [
  '@vercel/analytics/react',
  'react',
  'react-dom/client',
  'vite',
];

const missingModules = requiredModules.filter((moduleName) => {
  try {
    require.resolve(moduleName, { paths: [process.cwd()] });
    return false;
  } catch {
    return true;
  }
});

if (missingModules.length > 0) {
  console.error('\nRequired web dependencies are missing from node_modules:');
  for (const moduleName of missingModules) console.error(`  - ${moduleName}`);
  console.error('\nRestore the locked dependency tree with:');
  console.error('  npm install');
  console.error('');
  process.exit(1);
}
