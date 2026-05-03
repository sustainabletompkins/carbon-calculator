import { useState } from "react";

/**
 * Shown after payment when the user has multiple accounts (teams or individual)
 * to attribute the offset to.
 *
 * Props:
 *   accounts      – [{ legacyId, name, isIndividual, pounds }]
 *   totalPounds   – carbon lbs from this purchase
 *   totalDollars  – dollar amount paid
 *   onContribute  – (legacyId: number) => void
 *   onSkip        – () => void
 */
const TeamContributionModal = ({
  accounts,
  totalPounds,
  totalDollars,
  onContribute,
  onSkip,
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleContribute = async () => {
    if (selectedId === null) return;
    setLoading(true);
    await onContribute(selectedId);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/40">
            <span className="material-icons text-green-600 dark:text-green-400">
              account_circle
            </span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-light dark:text-text-dark leading-tight">
              Attribute Your Offset
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Choose which account should receive credit
            </p>
          </div>
        </div>

        {/* Purchase summary */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-3 mb-5 border border-green-200 dark:border-green-800 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">CO₂ offset</p>
            <p className="font-bold text-green-700 dark:text-green-400">
              {totalPounds.toFixed(0)} lbs
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">Amount paid</p>
            <p className="font-bold text-green-700 dark:text-green-400">
              ${totalDollars.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Account list */}
        <div className="space-y-2 mb-6">
          {accounts.map((account) => (
            <label
              key={account.legacyId}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                selectedId === account.legacyId
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20 shadow-sm"
                  : "border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 bg-white dark:bg-slate-800"
              }`}
            >
              <input
                type="radio"
                name="account"
                value={account.legacyId}
                checked={selectedId === account.legacyId}
                onChange={() => setSelectedId(account.legacyId)}
                className="accent-green-600 flex-shrink-0"
              />

              {/* Icon */}
              <span
                className={`material-icons text-lg flex-shrink-0 ${
                  account.isIndividual
                    ? "text-teal-500 dark:text-teal-400"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                {account.isIndividual ? "person" : "group"}
              </span>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-text-light dark:text-text-dark truncate leading-tight">
                  {account.name}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
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
            className="flex-1 inline-flex justify-center items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 text-white py-3 px-4 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed"
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

        <p className="text-[11px] text-center text-gray-400 dark:text-gray-500 mt-4">
          Skipping means this purchase won't count toward any team or individual leaderboard.
        </p>
      </div>
    </div>
  );
};

export default TeamContributionModal;
