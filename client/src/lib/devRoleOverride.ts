/**
 * Dev-only override that lets the admin RBAC UI be previewed as any staff
 * role, since the server has no concept of these roles yet and can't hand
 * out five real test accounts.
 *
 * `import.meta.env.DEV` is a compile-time constant Vite substitutes and then
 * dead-code-eliminates in production builds — every export here becomes
 * inert once built. Verify that by grepping the built `dist/` bundle for the
 * switcher's UI text, not by trusting this guard alone.
 */
import { useSyncExternalStore } from "react";
import type { AdminStaffRole } from "./adminPermissions";

let override: AdminStaffRole | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): AdminStaffRole | null {
  return import.meta.env.DEV ? override : null;
}

export function setDevRoleOverride(role: AdminStaffRole | null): void {
  if (!import.meta.env.DEV) return;
  override = role;
  listeners.forEach((listener) => listener());
}

/** The active preview role, or `null` when previewing the signed-in user's real role. */
export function useDevRoleOverride(): AdminStaffRole | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot,
    () => null,
  );
}
