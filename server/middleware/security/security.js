import helmet from 'helmet';

export const parseTrustProxy = () => {
    const isVercelRuntime = ['1', 'true'].includes(String(process.env.VERCEL || '').toLowerCase()) ||
        Boolean(process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL);
    if (isVercelRuntime) {
        return 1;
    }

    const raw = process.env.TRUST_PROXY;
    if (raw === undefined) {
        return false;
    }
    const normalized = String(raw).trim().toLowerCase();
    if (normalized === 'true') {
        return 1;
    }
    if (normalized === 'false') {
        return false;
    }
    const asNumber = Number(normalized);
    if (Number.isInteger(asNumber) && asNumber >= 0) {
        return asNumber;
    }
    return false;
};

export const isSecureRequest = (req) => {
    if (req.secure) {
        return true;
    }

    const forwardedProtocol = String(req.get('x-forwarded-proto') || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
    return forwardedProtocol === 'https';
};

export const applySecurityMiddleware = (app, { isProduction, enforceHttps = true }) => {
    // Security: only trust proxy headers when explicitly configured.
    app.set('trust proxy', parseTrustProxy());

    // Enforce HTTPS and HSTS in production
    if (isProduction && enforceHttps) {
        app.use((req, res, next) => {
            if (!isSecureRequest(req)) {
                return res.redirect(`https://${req.headers.host}${req.url}`);
            }
            res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
            next();
        });
    }

    app.use(
        helmet({
            // API serves uploaded files cross-origin in dev; keep resource policy permissive.
            crossOriginResourcePolicy: { policy: 'cross-origin' },
            // API does not serve app HTML; disable CSP here to avoid overblocking file previews.
            contentSecurityPolicy: false,
        })
    );
};
