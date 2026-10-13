const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');
const https = require('https');
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

const productionApiOrigin = 'https://microjobs-api-test.azurewebsites.net';
const configuredProxyTarget = process.env.MICROJOBS_METRO_API_TARGET || productionApiOrigin;
const apiProxyTarget = new URL(configuredProxyTarget);
const apiTransport = apiProxyTarget.protocol === 'https:' ? https : http;
const localProxyHost = /^(?:localhost|127(?:\.\d{1,3}){3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|::1)$/i;
if (localProxyHost.test(apiProxyTarget.hostname)) {
	throw new Error('Local Metro API targets are disabled. Use the deployed production API.');
}
const proxyPrefixes = [
	['/microjobs-api', ''],
	['/microjobs-socket', '/socket.io'],
];
const defaultEnhanceMiddleware = config.server?.enhanceMiddleware;

config.server = {
	...config.server,
	enhanceMiddleware: (metroMiddleware, metroServer) => {
		const fallbackMiddleware = typeof defaultEnhanceMiddleware === 'function'
			? defaultEnhanceMiddleware(metroMiddleware, metroServer)
			: metroMiddleware;

		return (request, response, next) => {
			const requestUrl = String(request.url || '');
			const mapping = proxyPrefixes.find(([prefix]) => requestUrl === prefix || requestUrl.startsWith(`${prefix}/`) || requestUrl.startsWith(`${prefix}?`));
			if (!mapping) return fallbackMiddleware(request, response, next);

			const [prefix, targetPrefix] = mapping;
			const proxyRequest = apiTransport.request({
				protocol: apiProxyTarget.protocol,
				hostname: apiProxyTarget.hostname,
				port: apiProxyTarget.port,
				method: request.method,
				path: `${targetPrefix}${requestUrl.slice(prefix.length)}`,
				headers: { ...request.headers, host: apiProxyTarget.host },
			}, (proxyResponse) => {
				response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
				proxyResponse.pipe(response);
			});
			proxyRequest.on('error', () => {
				if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json' });
				response.end(JSON.stringify({ message: 'The production MicroJobs API is unavailable.' }));
			});
			request.pipe(proxyRequest);
		};
	},
};

module.exports = config;
