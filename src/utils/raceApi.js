import { API_URL } from "./apiUrl";

/**
 * Client for the Carbon Race sign-up API (raceRoutes.js).
 *
 * No auth header: email is the identity across this whole app, the same way
 * the cart and offset records work. Every call throws an Error carrying the
 * server's message so forms can show it verbatim.
 */
async function raceJson(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_URL}/api/race${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** Regions the sign-up forms may offer — the list the server validates against. */
export const listRegions = () => raceJson("/regions");

/** Accounts this email is already attached to: { email, individual, teams }. */
export const getMyAccounts = (email) =>
  raceJson(`/me?email=${encodeURIComponent(email)}`);

/** Every team on the leaderboard, name-sorted, for the join picker. */
export const listTeams = () => raceJson("/teams");

/** Start a team. The creator is recorded as its founding member. */
export const createTeam = ({ email, name, memberName, regionId }) =>
  raceJson("/teams", { method: "POST", body: { email, name, memberName, regionId } });

/** Register this email as an individual competitor. */
export const registerIndividual = ({ email, name, regionId }) =>
  raceJson("/individuals", { method: "POST", body: { email, name, regionId } });

/** Join an existing team. */
export const joinTeam = (docId, { email, name }) =>
  raceJson(`/teams/${docId}/members`, { method: "POST", body: { email, name } });
