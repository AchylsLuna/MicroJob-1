// Learn more https://docs.expo.dev/guides/customizing-metro/
// NOTE: This root Metro config is for root-level tooling only.
// Mobile Expo runtime must use `Mobile/metro.config.js` with
// `EXPO_NO_METRO_WORKSPACE_ROOT=1` (see root `mobile:*` scripts).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDefaultConfig } from 'expo/metro-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Avoid resolving from the legacy nested Mobile/node_modules tree.
const mobileNodeModules = path.resolve(__dirname, 'Mobile/node_modules');
const escapedMobileNodeModules = mobileNodeModules
  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  .replace(/\//g, '[\\\\/]');
config.resolver.blockList = new RegExp(`^${escapedMobileNodeModules}[\\\\/].*`);

export default config;
