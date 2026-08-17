// Admin/Support accounts are platform staff, not marketplace participants.
// They have no public profile, so chat surfaces must never offer a profile link
// for them. The server is the source of truth (`otherUserIsStaff`); the optional
// `supportUserId` covers the brief window before conversations are reloaded
// after being opened straight from the Support Center.

export interface StaffConversationLike {
  otherUserId?: string | null;
  otherUserIsStaff?: boolean | null;
}

export function isStaffConversation(
  contact: StaffConversationLike | null | undefined,
  supportUserId?: string | null,
): boolean {
  if (!contact) return false;
  if (contact.otherUserIsStaff === true) return true;
  const otherUserId = String(contact.otherUserId || '').trim();
  const supportId = String(supportUserId || '').trim();
  return Boolean(otherUserId) && Boolean(supportId) && otherUserId === supportId;
}
