// src/config.ts
/**
 * Centralised config sourced from environment variables.
 *
 * Every user-visible string that could identify the owners lives here
 * so the repo stays safe for public visibility. Real values are kept
 * in `.env` (git-ignored); contributors only see `.env.example`.
 */

const env = import.meta.env;

export const config = {
  /** Brand name shown in navbar, footer, hero, etc. */
  coupleDisplay: (env.VITE_COUPLE_DISPLAY as string) || "Our Gallery",

  /** <title> and OG title */
  siteTitle: (env.VITE_SITE_TITLE as string) || "Private Gallery",

  /** Meta description */
  siteDescription:
    (env.VITE_SITE_DESCRIPTION as string) ||
    "A private photo gallery for our most cherished memories.",

  /** Login page heading */
  loginHeading:
    (env.VITE_LOGIN_HEADING as string) || "Welcome to our secret archive",

  /** Email used for Firebase Auth sign-in */
  authEmail: (env.VITE_AUTH_EMAIL as string) || "",

  /** Toast shown when user logs out */
  logoutToast: (env.VITE_LOGOUT_TOAST as string) || "Signed out ♥",

  /** 404 page message */
  notFoundText:
    (env.VITE_NOT_FOUND_TEXT as string) || "This page doesn't exist.",
} as const;
