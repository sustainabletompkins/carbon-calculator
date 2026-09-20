import { useEffect, useState } from "react";
import { Confetti } from "./ui/Confetti";
import { Alert } from "./ui";
import { listRegions } from "../utils/raceApi";
import AccountForm from "./race/AccountForm";
import TeamPicker from "./race/TeamPicker";

/**
 * Post-payment attribution prompt.
 *
 * Shown after every successful purchase, because this is also where someone
 * gets into the Carbon Race: as well as picking an account they're already
 * on, they can join a team, start one, or register as an individual, and the
 * offset they just paid for is credited to it straight away. Before that,
 * a first-time buyer saw nothing here and their purchase counted for nobody.
 *
 * `onContribute(docId)` credits the purchase and throws on failure, so a
 * problem is shown here rather than celebrated. `onClose` finishes checkout.
 */
const TeamContributionModal = ({
  accounts,
  email,
  totalPounds,
  totalDollars,
  onContribute,
  onClose,
}) => {
  // Tracked by position, not docId: ids have come through undefined or
  // duplicated, which left every radio reading as checked and the choice
  // impossible to change. A lone account arrives preselected.
  const [selectedIndex, setSelectedIndex] = useState(accounts.length === 1 ? 0 : null);
  const [view, setView] = useState("select"); // select | join | team | individual
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [succeeded, setSucceeded] = useState(false);
  const [creditedAccount, setCreditedAccount] = useState(null);
  const [regions, setRegions] = useState([]);

  const hasIndividual = accounts.some((a) => a.isIndividual);
  const teamDocIds = accounts.filter((a) => !a.isIndividual).map((a) => a.docId);

  useEffect(() => {
    listRegions()
      .then(setRegions)
      .catch(() => {}); // non-critical — the region select just stays empty
  }, []);

  /** Credit the purchase to `account`, then celebrate or explain. */
  const creditTo = async (account) => {
    if (!account?.docId) return;
    setError(null);
    setView("select");
    setBusy(true);
    try {
      await onContribute(account.docId);
      setCreditedAccount(account);
      setSucceeded(true);
    } catch (err) {
      setError(err.message || "Could not credit this offset. Your payment went through.");
    } finally {
      setBusy(false);
    }
  };

  // Auto-close after showing the success state
  useEffect(() => {
    if (!succeeded) return;
    const t = setTimeout(() => onClose(), 2800);
    return () => clearTimeout(t);
  }, [succeeded, onClose]);

  const heading =
    view === "join"
      ? { icon: "group_add", title: "Join a team", sub: "Your offset is credited to it once you join." }
      : view === "team"
        ? { icon: "groups", title: "Start a team", sub: "Your offset becomes its first contribution." }
        : view === "individual"
          ? { icon: "person_add", title: "Race as an individual", sub: "Your own entry on the leaderboard." }
          : {
              icon: "account_circle",
              title: "Attribute Your Offset",
              sub: accounts.length
                ? "Choose which account should receive credit"
                : "Get on the leaderboard so this offset counts",
            };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full p-6 relative overflow-y-auto max-h-[90vh] text-left ${
          view === "select" ? "max-w-md" : "max-w-lg"
        }`}
      >
        {succeeded ? (
          /* ── Success state ──────────────────────────────── */
          <>
            <Confetti count={24} contained />

            <div className="flex flex-col items-center text-center py-4 gap-4">
              <div className="w-20 h-20 rounded-full bg-primary-tint flex items-center justify-center animate-bounce-in">
                <span className="material-icons text-primary" style={{ fontSize: '52px' }}>
                  check_circle
                </span>
              </div>

              <div
                className="animate-fade-in"
                style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
              >
                <h3 className="text-xl font-bold text-text leading-tight">
                  Offset credited!
                </h3>
                {creditedAccount && (
                  <p className="text-base text-muted mt-2">
                    {totalPounds.toFixed(0)} lbs CO₂ added to{" "}
                    <span className="font-semibold text-primary">
                      {creditedAccount.name}
                    </span>
                  </p>
                )}
                <p className="text-sm text-subtle mt-3">
                  Every pound counts. Thank you! 🌱
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              {view !== "select" && (
                <button
                  onClick={() => setView("select")}
                  disabled={busy}
                  aria-label="Back"
                  className="shrink-0 text-muted hover:text-text transition-colors"
                >
                  <span aria-hidden="true" className="material-icons">arrow_back</span>
                </button>
              )}
              <div className="p-2 rounded-lg bg-primary-tint">
                <span aria-hidden="true" className="material-icons text-primary">{heading.icon}</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-text-light dark:text-text-dark leading-tight">
                  {heading.title}
                </h3>
                <p className="text-xs text-muted">{heading.sub}</p>
              </div>
            </div>

            {/* Purchase summary */}
            <div className="bg-primary-tint rounded-lg px-4 py-3 mb-5 border border-primary/30 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted">CO₂ offset</p>
                <p className="font-bold text-primary">{totalPounds.toFixed(0)} lbs</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">Amount paid</p>
                <p className="font-bold text-primary">${totalDollars.toFixed(2)}</p>
              </div>
            </div>

            {error && (
              <Alert variant="error" className="mb-4" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {busy && (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                <p className="text-sm text-muted">Crediting your offset…</p>
              </div>
            )}

            {!busy && view === "select" && (
              <>
                {accounts.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {accounts.map((account, index) => (
                      <label
                        key={account.docId ?? index}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedIndex === index
                            ? "border-primary bg-primary-tint shadow-sm"
                            : "border-gray-200 dark:border-gray-700 hover:border-primary/40 bg-white dark:bg-slate-800"
                        }`}
                      >
                        <input
                          type="radio"
                          name="account"
                          value={index}
                          checked={selectedIndex === index}
                          onChange={() => setSelectedIndex(index)}
                          className="accent-green-600 flex-shrink-0"
                        />
                        <span
                          className={`material-icons text-lg flex-shrink-0 ${
                            account.isIndividual ? "text-secondary" : "text-primary"
                          }`}
                          aria-hidden="true"
                        >
                          {account.isIndividual ? "person" : "group"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-text-light dark:text-text-dark truncate leading-tight">
                            {account.name}
                          </p>
                          <p className="text-[11px] text-muted mt-0.5">
                            {account.isIndividual ? "Individual account" : "Team"}
                            {account.pounds != null && account.pounds > 0
                              ? ` · ${new Intl.NumberFormat("en-US").format(Math.round(account.pounds))} lbs total`
                              : ""}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <Alert variant="info" className="mb-4" title="You're not in the Carbon Race yet">
                    Join a team, start one, or race on your own so this offset counts toward the
                    leaderboard.
                  </Alert>
                )}

                {/* Ways onto the leaderboard from right here */}
                <div className="mb-5">
                  {accounts.length > 0 && (
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex-1 h-px bg-border" />
                      <span className="text-[11px] uppercase tracking-wide text-subtle">or</span>
                      <span className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => setView("join")}
                      className="p-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary transition-colors text-center"
                    >
                      <span aria-hidden="true" className="material-icons text-primary" style={{ fontSize: "20px" }}>group_add</span>
                      <p className="text-xs font-semibold text-text-light dark:text-text-dark">Join a team</p>
                    </button>
                    <button
                      onClick={() => setView("team")}
                      className="p-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary transition-colors text-center"
                    >
                      <span aria-hidden="true" className="material-icons text-primary" style={{ fontSize: "20px" }}>groups</span>
                      <p className="text-xs font-semibold text-text-light dark:text-text-dark">Start a team</p>
                    </button>
                    <button
                      onClick={() => setView("individual")}
                      disabled={hasIndividual}
                      title={hasIndividual ? "You already have an individual account" : undefined}
                      className="p-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary transition-colors text-center disabled:opacity-40 disabled:hover:border-gray-200 disabled:cursor-not-allowed"
                    >
                      <span aria-hidden="true" className="material-icons text-primary" style={{ fontSize: "20px" }}>person_add</span>
                      <p className="text-xs font-semibold text-text-light dark:text-text-dark">Race solo</p>
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {accounts.length > 0 && (
                    <button
                      onClick={() => creditTo(accounts[selectedIndex])}
                      disabled={!accounts[selectedIndex]?.docId}
                      className="flex-1 inline-flex justify-center items-center gap-2 bg-primary hover:bg-primary-hover disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 text-white py-3 px-4 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed"
                    >
                      <span aria-hidden="true" className="material-icons text-sm">add_task</span>
                      Confirm
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="flex-1 inline-flex justify-center items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-3 px-4 rounded-xl font-medium transition-colors"
                  >
                    {accounts.length > 0 ? "Skip" : "Not now"}
                  </button>
                </div>

                <p className="text-[11px] text-center text-muted mt-4">
                  Skipping means this purchase won't count toward any team or individual leaderboard.
                </p>
              </>
            )}

            {!busy && view === "join" && (
              <TeamPicker
                email={email}
                memberOfDocIds={teamDocIds}
                onCancel={() => setView("select")}
                onJoined={(team) => creditTo(team)}
              />
            )}

            {!busy && (view === "team" || view === "individual") && (
              <AccountForm
                mode={view === "team" ? "team" : "individual"}
                email={email}
                regions={regions}
                onCancel={() => setView("select")}
                onCreated={(created) => creditTo(created)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TeamContributionModal;
