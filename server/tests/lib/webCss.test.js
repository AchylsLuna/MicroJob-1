import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import config from '../../../client/postcss.config.js';

const requireWeb = createRequire(new URL('../../../package.json', import.meta.url));

test('web PostCSS pipeline compiles the dashboard styles and custom Tailwind tokens', async () => {
  const postcss = requireWeb('postcss');
  const plugins = Object.entries(config.plugins).map(([name, options]) => requireWeb(name)(options));
  const source = fileURLToPath(new URL('../../../client/src/index.css', import.meta.url));
  const result = await postcss(plugins).process(readFileSync(source, 'utf8'), { from: source });
  assert.doesNotMatch(result.css, /@tailwind|@apply/);
  assert.match(result.css, /\.dashboard-scope \.ui-page/);
  assert.match(result.css, /\.bg-brand-500/);
});
