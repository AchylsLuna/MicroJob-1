const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');
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

const apiProxyTarget = new URL(process.env.MICROJOBS_METRO_API_TARGET || 'http://127.0.0.1:5050');
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
			const proxyRequest = http.request({
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
				response.end(JSON.stringify({ message: 'The local MicroJobs API is unavailable.' }));
			});
			request.pipe(proxyRequest);
		};
	},
};

module.exports = config;
