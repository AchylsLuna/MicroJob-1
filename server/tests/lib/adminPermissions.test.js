import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission, normalizeStaffRole, resolveStaffRole } from "../../lib/adminPermissions.js";

test("superadmin holds every permission implicitly", () => {
  assert.equal(hasPermission("superadmin", "staff.create"), true);
  assert.equal(hasPermission("superadmin", "finance.disputes.handle"), true);
});

test("a staff role only holds the permissions in its matrix row", () => {
  assert.equal(hasPermission("analytics_team", "analytics.view"), true);
  assert.equal(hasPermission("analytics_team", "users.view"), false);
  assert.equal(hasPermission("support_staff", "users.suspend"), false);
  assert.equal(hasPermission("moderator", "moderation.enforce"), true);
  assert.equal(hasPermission("finance_team", "finance.payouts.review"), true);
});

test("a missing or non-staff role holds nothing", () => {
  assert.equal(hasPermission(null, "users.view"), false);
  assert.equal(hasPermission(undefined, "users.view"), false);
});

test("role names are normalized across spellings", () => {
  assert.equal(normalizeStaffRole("Finance Team"), "finance_team");
  assert.equal(normalizeStaffRole("finance-team"), "finance_team");
  assert.equal(normalizeStaffRole("financeTeam"), "finance_team");
  assert.equal(normalizeStaffRole("worker"), null);
});

test("resolveStaffRole reads superadmin from role and sub-roles from staffRole", () => {
  assert.equal(resolveStaffRole({ role: "superadmin" }), "superadmin");
  assert.equal(resolveStaffRole({ role: "admin", staffRole: "moderator" }), "moderator");
  assert.equal(resolveStaffRole({ role: "work" }), null);
});

test("legacy admins with no staffRole fall back to admin_team rather than losing access", () => {
  assert.equal(resolveStaffRole({ role: "admin", staffRole: null }), "admin_team");
  assert.equal(resolveStaffRole({ role: "admin" }), "admin_team");
  // The fallback is a narrowing, not full access: admin_team has no finance reach.
  assert.equal(hasPermission(resolveStaffRole({ role: "admin" }), "staff.view"), true);
  assert.equal(hasPermission(resolveStaffRole({ role: "admin" }), "finance.payouts.review"), false);
});
