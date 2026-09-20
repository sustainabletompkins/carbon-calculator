export const fmtMoney = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

export const fmtPounds = (n) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0)} lbs`;

export const fmtInt = (n) => new Intl.NumberFormat("en-US").format(n || 0);

export const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "—";

export const toDateInput = (iso) => (iso ? new Date(iso).toLocaleDateString("en-CA") : "");

export const SOURCE_LABELS = { website: "Website", manual: "Manual", legacy: "Imported" };

export const PAYMENT_METHODS = [
  ["check", "Check"],
  ["cash", "Cash"],
  ["credit_card", "Credit card"],
  ["ach", "Bank transfer"],
  ["stock", "Stock / securities"],
  ["in_kind", "In-kind"],
  ["other", "Other"],
];
