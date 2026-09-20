import { useSyncExternalStore } from "react";
import { loadStripe } from "@stripe/stripe-js";

/**
 * Stripe.js is fetched straight from Stripe's CDN (js.stripe.com), so the
 * download can fail for reasons that have nothing to do with this app: a
 * dropped HTTP/3 connection (ERR_QUIC_PROTOCOL_ERROR), a corporate proxy, a
 * VPN, or a moment offline.
 *
 * loadStripe() only tries once and caches the rejection, so a single bad
 * moment left checkout dead for the rest of the session — with no message,
 * just a permanently disabled Pay button and an uncaught promise rejection in
 * the console. It does clear its cached promise and re-inject the <script> on
 * error, though, so calling it again is a real retry.
 */

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const RETRY_DELAYS_MS = [1000, 3000, 8000];

// "loading" | "retrying" | "ready" | "failed" | "missing-key"
let status = PUBLISHABLE_KEY ? "loading" : "missing-key";
const listeners = new Set();

const setStatus = (next) => {
  if (next === status) return;
  status = next;
  listeners.forEach((notify) => notify());
};

const subscribe = (notify) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadWithRetry() {
  if (!PUBLISHABLE_KEY) {
    console.error(
      "VITE_STRIPE_PUBLISHABLE_KEY is not set. It is baked in at build time, " +
        "so it must be present when `npm run build` runs — not just at deploy."
    );
    return null;
  }

  for (let attempt = 0; ; attempt++) {
    try {
      const stripe = await loadStripe(PUBLISHABLE_KEY);
      if (!stripe) throw new Error("Stripe.js loaded but returned no instance");
      setStatus("ready");
      return stripe;
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length) {
        console.error("Could not load Stripe.js after retrying:", err);
        setStatus("failed");
        // Resolve rather than reject: a rejected promise here becomes an
        // uncaught rejection and tells <Elements> nothing useful.
        return null;
      }
      const delay = RETRY_DELAYS_MS[attempt];
      console.warn(
        `Stripe.js failed to load (attempt ${attempt + 1} of ${RETRY_DELAYS_MS.length + 1}), ` +
          `retrying in ${delay}ms`,
        err
      );
      setStatus("retrying");
      await sleep(delay);
    }
  }
}

export const stripePromise = loadWithRetry();

/** Current load state, for UI that needs to explain why checkout is unavailable. */
export function useStripeStatus() {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => status
  );
}
