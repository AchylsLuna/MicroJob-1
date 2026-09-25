export type ProfileVerification = {
  emailVerified?: boolean;
  phoneVerified?: boolean;
  identityDocument?: { status?: string };
  addressDocument?: { status?: string };
};

/** Matches the four completed steps returned by /auth/verification/status. */
export function isProfileFullyVerified(verification?: ProfileVerification | null) {
  return verification?.emailVerified === true
    && verification?.phoneVerified === true
    && verification?.identityDocument?.status === "complete"
    && verification?.addressDocument?.status === "complete";
}
