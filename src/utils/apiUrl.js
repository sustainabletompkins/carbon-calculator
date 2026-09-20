/**
 * Base URL for the Express API.
 *
 * Production: the API is served by the same App Engine service as the site
 * (see app.yaml), so requests are same-origin and the base is "". A localhost
 * value left in .env is ignored in production builds — browsers block public
 * pages from calling loopback addresses.
 *
 * Development: defaults to the local Express server.
 */
const configured = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const isLoopback = /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(configured);

export const API_URL = import.meta.env.PROD
  ? configured && !isLoopback
    ? configured
    : ""
  : configured || "http://localhost:3000";
