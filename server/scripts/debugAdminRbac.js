#!/usr/bin/env node
/**
 * Prints the admin role -> route access matrix.
 *
 * READ-ONLY: this never connects to MongoDB and never writes anything. It
 * reads the permission matrix (lib/adminPermissions.js) and the route table
 * (routes/AdminRoute.js) and reports what each staff role can actually reach,
 * so a permission gap is visible rather than discovered as a 403 in the UI.
 *
 * Usage:
 *   node scripts/debugAdminRbac.js              # full matrix
 *   node scripts/debugAdminRbac.js moderator    # one role
 *   node scripts/debugAdminRbac.js --orphans    # only unreachable routes
 */
import adminRouter from '../routes/AdminRoute.js';
import { ROLE_PERMISSIONS, hasPermission, resolveStaffRole } from '../lib/adminPermissions.js';

const ALL_ROLES = ['superadmin', ...Object.keys(ROLE_PERMISSIONS).filter((role) => role !== 'superadmin')];

/**
 * Recovers each route's required permission by re-running its middleware stack
 * against a probe user per role — the gate is a closure, so its permission
 * string cannot be read directly off the layer.
 */
function collectRoutes() {
  return adminRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => {
      const method = Object.keys(layer.route.methods)[0].toUpperCase();
      const handlers = layer.route.stack.map((entry) => entry.handle);
      return { method, path: layer.route.path, handlers };
    });
}

/** True when `role` clears every requirePermission gate on the route. */
function roleCanReach(route, role) {
  const user = role === 'superadmin' ? { role: 'superadmin' } : { role: 'admin', staffRole: role };
  // Every handler except the final controller is a gate; run them and see if
  // any responds 403 instead of calling next().
  for (const handler of route.handlers.slice(0, -1)) {
    let allowed = false;
    let denied = false;
    const res = {
      status() { denied = true; return this; },
      json() { return this; },
    };
    try {
      handler({ user, params: {}, body: {}, method: route.method }, res, () => { allowed = true; });
    } catch {
      return false;
    }
    if (denied || !allowed) return false;
  }
  return true;
}

const arg = process.argv[2];
const routes = collectRoutes();
const roles = arg && !arg.startsWith('--') ? [arg] : ALL_ROLES;

if (arg && !arg.startsWith('--') && !ALL_ROLES.includes(arg)) {
  console.error(`Unknown role "${arg}". Known roles: ${ALL_ROLES.join(', ')}`);
  process.exit(1);
}

console.log(`\nAdmin RBAC matrix — ${routes.length} routes, ${ALL_ROLES.length} roles\n`);

if (process.argv.includes('--orphans')) {
  const orphans = routes.filter((route) => !ALL_ROLES.some((role) => roleCanReach(route, role)));
  const superadminOnly = routes.filter(
    (route) => roleCanReach(route, 'superadmin') && !ALL_ROLES.filter((r) => r !== 'superadmin').some((role) => roleCanReach(route, role)),
  );
  console.log(orphans.length ? 'UNREACHABLE BY ANY ROLE:' : 'No unreachable routes.');
  orphans.forEach((route) => console.log(`  ${route.method.padEnd(6)} ${route.path}`));
  console.log(`\nSUPERADMIN-ONLY (${superadminOnly.length}):`);
  superadminOnly.forEach((route) => console.log(`  ${route.method.padEnd(6)} ${route.path}`));
  console.log();
  process.exit(0);
}

for (const role of roles) {
  const reachable = routes.filter((route) => roleCanReach(route, role));
  console.log(`${role}  (${reachable.length}/${routes.length} routes)`);
  for (const route of reachable) {
    console.log(`  ✓ ${route.method.padEnd(6)} ${route.path}`);
  }
  const blocked = routes.filter((route) => !roleCanReach(route, role));
  if (blocked.length && roles.length === 1) {
    console.log(`  --- blocked ---`);
    blocked.forEach((route) => console.log(`  ✗ ${route.method.padEnd(6)} ${route.path}`));
  }
  console.log();
}

// A legacy admin (no staffRole) must not be locked out — see resolveStaffRole.
const legacy = resolveStaffRole({ role: 'admin', staffRole: null });
console.log(`Legacy admin (no staffRole) resolves to: ${legacy}`);
console.log(`  can staff.view:            ${hasPermission(legacy, 'staff.view')}`);
console.log(`  can finance.payouts.review: ${hasPermission(legacy, 'finance.payouts.review')}\n`);
