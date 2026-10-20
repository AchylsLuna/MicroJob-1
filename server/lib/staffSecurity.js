export const isStaffAccount = (user) => user?.role === 'admin' || user?.role === 'superadmin';
export const staffPasswordChangeSubject = (user) => `staff-password-change:${user._id}`;
export const hasVerifiedSecondaryEmail = (user) => Boolean(user.secondaryEmail && user.secondaryEmailVerifiedAt);

export const matchesStaffLoginChallenge = (user, challenge) => {
  if (!isStaffAccount(user)) return !challenge.metadata?.staffLogin;
  return hasVerifiedSecondaryEmail(user) && challenge.metadata?.staffLogin === true
    && challenge.metadata.email === user.secondaryEmail
    && challenge.metadata.primaryEmail === user.email
    && challenge.metadata.secondaryEmailVerifiedAt === user.secondaryEmailVerifiedAt.toISOString();
};
