import monitor from '../lib/monitor.js';
import { resolveStaffRole } from '../lib/adminPermissions.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function deriveTarget(req, payload) {
  const params = req.params || {};
  const paramTarget = params.userId || params.payoutRequestId || params.ticketId || params.reportId || params.disputeId || params.id;
  if (paramTarget) {
    return params.documentType ? `${paramTarget}:${params.documentType}` : String(paramTarget);
  }
  if (req.body?.email) return String(req.body.email);
  if (payload && typeof payload === 'object') {
    const created = payload.user || payload.staff || payload.report || payload.dispute;
    if (created?.email) return String(created.email);
    if (created?._id) return String(created._id);
  }
  return null;
}

/**
 * Mounted on the admin router after `auth`/`requireAdmin`: automatically
 * records an AuditLog entry for every mutating request any admin role makes,
 * regardless of which staff sub-role made it or whether the controller calls
 * `monitor.audit()` itself. This is the safety net that guarantees every
 * admin role's actions are logged — see docs/frontend-only-scope.md §7.
 */
export default function adminAuditLog(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();

  let responsePayload;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    responsePayload = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    const actorRole = resolveStaffRole(req.user) || req.user?.role || null;
    const routePath = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.originalUrl.split('?')[0];
    const isError = res.statusCode >= 400;

    monitor
      .audit({
        actor: req.user?.id || req.user?.userId || null,
        actorRole,
        action: `${req.method} ${routePath}`,
        target: deriveTarget(req, responsePayload),
        reason: isError ? responsePayload?.message || null : null,
        category: isError ? 'error' : 'system',
        status: String(res.statusCode),
        ip: req.ip || null,
        userAgent: req.get?.('user-agent') || null,
        meta: { statusCode: res.statusCode, params: req.params },
      })
      .catch(() => {});
  });

  next();
}
