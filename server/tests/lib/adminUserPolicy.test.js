import test from "node:test";
import assert from "node:assert/strict";
import { getAdminUserMutationError } from "../../lib/adminUserPolicy.js";

test("normal admins cannot manage privileged roles", () => {
  const result = getAdminUserMutationError({ actorRole: "admin", actorId: "a", targetId: "u", targetRole: "work", nextRole: "admin", nextStatus: "active", activeSuperadminCount: 1 });
  assert.equal(result?.status, 403);
});

test("administrators cannot change their own role or disable themselves", () => {
  assert.equal(getAdminUserMutationError({ actorRole: "superadmin", actorId: "a", targetId: "a", targetRole: "superadmin", nextRole: "admin", nextStatus: "active", activeSuperadminCount: 2 })?.status, 403);
  assert.equal(getAdminUserMutationError({ actorRole: "admin", actorId: "a", targetId: "a", targetRole: "admin", nextRole: "admin", nextStatus: "disabled", activeSuperadminCount: 2 })?.status, 403);
});

test("the last active superadmin cannot be demoted or disabled", () => {
  const result = getAdminUserMutationError({ actorRole: "superadmin", actorId: "a", targetId: "b", targetRole: "superadmin", nextRole: "work", nextStatus: "active", activeSuperadminCount: 1 });
  assert.equal(result?.status, 409);
});

test("a superadmin may update a different account when another superadmin remains", () => {
  const result = getAdminUserMutationError({ actorRole: "superadmin", actorId: "a", targetId: "b", targetRole: "superadmin", nextRole: "admin", nextStatus: "active", activeSuperadminCount: 2 });
  assert.equal(result, null);
});
