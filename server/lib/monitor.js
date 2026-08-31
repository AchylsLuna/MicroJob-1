import AuditLog from '../models/AuditLog.js';
import Alert from '../models/Alert.js';

// Simple in-memory sliding-window counters for alerts.
const windows = {
  failures: new Map(), // key -> [timestamps]
  topups: new Map() // key -> [timestamps]
};

const defaults = {
  failureWindowSec: Number(process.env.ALERT_FAILURE_WINDOW_SEC || 300), // 5m
  failureThreshold: Number(process.env.ALERT_FAILURE_THRESHOLD || 10),
  topupWindowSec: Number(process.env.ALERT_TOPUP_WINDOW_SEC || 300),
  topupThreshold: Number(process.env.ALERT_TOPUP_THRESHOLD || 10)
};

function prune(list, windowSec) {
  const cutoff = Date.now() - windowSec * 1000;
  while (list.length && list[0] < cutoff) list.shift();
}

async function raiseAlert(type, description, metadata = {}) {
  console.warn('ALERT:', type, description, metadata);
  try {
    await Alert.create({ type, description, count: 1, metadata });
  } catch (e) {
    console.error('Failed to persist alert', e);
  }
}

export async function recordFailure({ key = 'global', userId = null, ip = null, device: _device = null, reason = null } = {}) {
  const now = Date.now();
  const mapKey = `${key}:${userId || 'anon'}:${ip || 'noip'}`;
  const list = windows.failures.get(mapKey) || [];
  list.push(now);
  prune(list, defaults.failureWindowSec);
  windows.failures.set(mapKey, list);

  if (list.length >= defaults.failureThreshold) {
    await raiseAlert('failure_spike', `High failure spike for ${mapKey}`, { count: list.length, reason });
  }
}

export async function recordTopUp({ userId = null, ip = null } = {}) {
  const now = Date.now();
  const mapKey = `${userId || 'anon'}:${ip || 'noip'}`;
  const list = windows.topups.get(mapKey) || [];
  list.push(now);
  prune(list, defaults.topupWindowSec);
  windows.topups.set(mapKey, list);

  if (list.length >= defaults.topupThreshold) {
    await raiseAlert('topup_spike', `Many top-ups for ${mapKey}`, { count: list.length });
  }
}

export async function audit(opts = {}) {
  const sensitiveKey = /authorization|cookie|token|secret|password|otp|code|email|phone|contact|card|cvv|cvc/i;
  const redact = (value, depth = 0) => {
    if (depth > 4 || value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? '[REDACTED]' : redact(item, depth + 1),
    ]));
  };
  const safeMeta = redact(opts.meta || {});
  try {
    await AuditLog.create({
      actor: opts.actor || null,
      actorRole: opts.actorRole || null,
      action: opts.action || 'unknown',
      target: opts.target || null,
      reason: opts.reason || null,
      category: opts.category === 'error' ? 'error' : 'system',
      ip: opts.ip || null,
      userAgent: opts.userAgent || null,
      device: opts.device || null,
      amount: typeof opts.amount === 'number' ? opts.amount : null,
      status: opts.status || 'initiated',
      meta: safeMeta
    });
  } catch (e) {
    console.error('Failed to write audit log', e);
  }
}

export default { recordFailure, recordTopUp, audit };
