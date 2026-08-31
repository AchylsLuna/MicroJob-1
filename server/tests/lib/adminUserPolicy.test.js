import test from "node:test";
import assert from "node:assert/strict";
import { getAdminUserCreationError, getAdminUserMutationError } from "../../lib/adminUserPolicy.js";

test("only superadmins may create administrator accounts", () => {
  assert.equal(getAdminUserCreationError({ actorRole: "admin", newRole: "admin" })?.status, 403);
  assert.equal(getAdminUserCreationError({ actorRole: "superadmin", newRole: "admin" }), null);
  assert.equal(getAdminUserCreationError({ actorRole: "admin", newRole: "work" }), null);
});

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

test("admin_team may create the four delegable staff sub-roles", () => {
  assert.equal(
    getAdminUserCreationError({ actorRole: "admin", actorStaffRole: "admin_team", newRole: "admin", newStaffRole: "moderator" }),
    null,
  );
  assert.equal(
    getAdminUserCreationError({ actorRole: "admin", actorStaffRole: "admin_team", newRole: "admin", newStaffRole: "finance_team" }),
    null,
  );
});

test("only a superadmin may create another admin_team member", () => {
  assert.equal(
    getAdminUserCreationError({ actorRole: "admin", actorStaffRole: "admin_team", newRole: "admin", newStaffRole: "admin_team" })?.status,
    403,
  );
  assert.equal(
    getAdminUserCreationError({ actorRole: "superadmin", newRole: "admin", newStaffRole: "admin_team" }),
    null,
  );
});

test("a staff role without staff.create cannot create staff accounts", () => {
  assert.equal(
    getAdminUserCreationError({ actorRole: "admin", actorStaffRole: "moderator", newRole: "admin", newStaffRole: "support_staff" })?.status,
    403,
  );
  assert.equal(
    getAdminUserCreationError({ actorRole: "admin", actorStaffRole: "analytics_team", newRole: "admin", newStaffRole: "support_staff" })?.status,
    403,
  );
});

test("admin_team may manage a delegable sub-role but never an admin_team peer", () => {
  assert.equal(
    getAdminUserMutationError({
      actorRole: "admin", actorStaffRole: "admin_team", actorId: "a", targetId: "b",
      targetRole: "admin", targetStaffRole: "moderator", nextRole: "admin", nextStaffRole: "support_staff", nextStatus: "active",
    }),
    null,
  );
  assert.equal(
    getAdminUserMutationError({
      actorRole: "admin", actorStaffRole: "admin_team", actorId: "a", targetId: "b",
      targetRole: "admin", targetStaffRole: "admin_team", nextRole: "admin", nextStaffRole: "moderator", nextStatus: "active",
    })?.status,
    403,
  );
});

test("a staff role without staff.assignRole cannot manage other staff", () => {
  assert.equal(
    getAdminUserMutationError({
      actorRole: "admin", actorStaffRole: "support_staff", actorId: "a", targetId: "b",
      targetRole: "admin", targetStaffRole: "moderator", nextRole: "admin", nextStaffRole: "moderator", nextStatus: "disabled",
    })?.status,
    403,
  );
});
