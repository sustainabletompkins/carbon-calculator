import { useState, useEffect } from "react";
import { Confetti } from "./ui/Confetti";

const TeamContributionModal = ({
  accounts,
  totalPounds,
  totalDollars,
  onContribute,
  onSkip,
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const handleContribute = async () => {
    if (selectedId === null) return;
    const account = accounts.find((a) => a.docId === selectedId);
    setLoading(true);
    await onContribute(selectedId);
    setLoading(false);
    setSelectedAccount(account);
    setSucceeded(true);
  };

  // Auto-close after showing the success state
  useEffect(() => {
    if (!succeeded) return;
    const t = setTimeout(() => onSkip(), 2800);
    return () => clearTimeout(t);
  }, [succeeded, onSkip]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative overflow-hidden">

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
                {selectedAccount && (
                  <p className="text-base text-muted mt-2">
                    {totalPounds.toFixed(0)} lbs CO₂ added to{" "}
                    <span className="font-semibold text-primary">
                      {selectedAccount.name}
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
          /* ── Selection state ────────────────────────────── */
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary-tint">
                <span className="material-icons text-primary">account_circle</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-light dark:text-text-dark leading-tight">
                  Attribute Your Offset
                </h3>
                <p className="text-xs text-muted">
                  Choose which account should receive credit
                </p>
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

            {/* Account list */}
            <div className="space-y-2 mb-6">
              {accounts.map((account) => (
                <label
                  key={account.docId}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedId === account.docId
                      ? "border-primary bg-primary-tint shadow-sm"
                      : "border-gray-200 dark:border-gray-700 hover:border-primary/40 bg-white dark:bg-slate-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="account"
                    value={account.docId}
                    checked={selectedId === account.docId}
                    onChange={() => setSelectedId(account.docId)}
                    className="accent-green-600 flex-shrink-0"
                  />
                  <span
                    className={`material-icons text-lg flex-shrink-0 ${
                      account.isIndividual ? "text-secondary" : "text-primary"
                    }`}
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

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleContribute}
                disabled={selectedId === null || loading}
                className="flex-1 inline-flex justify-center items-center gap-2 bg-primary hover:bg-primary-hover disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 text-white py-3 px-4 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed"
              >
                <span className="material-icons text-sm">add_task</span>
                {loading ? "Saving…" : "Confirm"}
              </button>
              <button
                onClick={onSkip}
                disabled={loading}
                className="flex-1 inline-flex justify-center items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-3 px-4 rounded-xl font-medium transition-colors"
              >
                Skip
              </button>
            </div>

            <p className="text-[11px] text-center text-muted mt-4">
              Skipping means this purchase won't count toward any team or individual leaderboard.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default TeamContributionModal;
