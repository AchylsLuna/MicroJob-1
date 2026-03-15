const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const reactRefreshRuntime = path.join(__dirname, 'node_modules', 'react-refresh', 'runtime.js');
const reactRefreshDevRuntime = path.join(
	__dirname,
	'node_modules',
	'react-refresh',
	'cjs',
	'react-refresh-runtime.development.js'
);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (moduleName === 'react-refresh/runtime' || moduleName === 'react-refresh/runtime.js') {
		return {
			type: 'sourceFile',
			filePath: reactRefreshRuntime,
		};
	}

	if (moduleName === 'react-refresh/cjs/react-refresh-runtime.development.js') {
		return {
			type: 'sourceFile',
			filePath: reactRefreshDevRuntime,
		};
	}

	if (typeof defaultResolveRequest === 'function') {
		return defaultResolveRequest(context, moduleName, platform);
	}

	return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
