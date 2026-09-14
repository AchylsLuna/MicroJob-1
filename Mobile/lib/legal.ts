/**
 * Mirrors `client/src/constants/legal.ts` verbatim.
 *
 * `client/src` and `Mobile/` are separate npm workspaces with separate
 * bundlers, so this is duplicated rather than shared — same reasoning as
 * `Mobile/theme/categoryVisuals.ts`. Keep both files in sync by hand.
 */
export const LEGAL_INFO = {
  brandName: "Micro Jobs",
  legalEntity: "Micro Jobs Project Team",
  supportEmail: "support@microjobs.ph",
  supportPhone: "+63 2 8123 4567",
  supportPhoneHref: "tel:+63281234567",
  governingLaw: "Republic of the Philippines",
  effectiveDate: "February 22, 2026",
} as const;
