import { useEffect, useState } from "react";
import { Trophy, TrendingUp } from "lucide-react";

export default function Leaderboard() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("pounds");

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
        console.log("Fetching from:", `${apiUrl}/api/team-funding`);
        
        const response = await fetch(`${apiUrl}/api/team-funding`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setTeams(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching team data:", err);
        setError(`${err.message}. Make sure the backend server is running on port 3000.`);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, []);

  // Sort teams based on selected criteria
  const sortedTeams = [...teams].sort((a, b) => {
    if (sortBy === "pounds") {
      return b.pounds - a.pounds;
    } else if (sortBy === "count") {
      return b.count - a.count;
    }
    return 0;
  });

  const formatCurrency = (pounds) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(pounds);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-slate-50 dark:from-background-dark dark:to-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-amber-500" />
            <h1 className="text-4xl font-bold text-text-light dark:text-text-dark">
              Leaderboard
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Top contributing teams to our carbon offset initiative
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setSortBy("pounds")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              sortBy === "pounds"
                ? "bg-green-600 text-white"
                : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700"
            }`}
          >
            Sort by Amount
          </button>
          <button
            onClick={() => setSortBy("count")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              sortBy === "count"
                ? "bg-green-600 text-white"
                : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700"
            }`}
          >
            Sort by Count
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-300">Error: {error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        )}

        {/* Leaderboard Table */}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Team
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTeams.map((team, index) => {
                  const rank = index + 1;
                  const isTopThree = rank <= 3;
                  const medalEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";

                  return (
                    <tr
                      key={team.team}
                      className={`border-b border-gray-100 dark:border-slate-800 transition-colors ${
                        isTopThree
                          ? "bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-900/20 dark:to-transparent hover:from-amber-100 dark:hover:from-amber-900/30"
                          : "hover:bg-gray-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isTopThree ? (
                            <span className="text-2xl">{medalEmoji}</span>
                          ) : (
                            <span className="font-semibold text-gray-500 dark:text-gray-400 w-6">
                              {rank}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-light dark:text-text-dark">
                          {team.team}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(team.pounds)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300">
                          <TrendingUp className="w-4 h-4" />
                          {team.count}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && teams.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              No team data available
            </p>
          </div>
        )}

        {/* Summary Stats */}
        {!loading && !error && teams.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Total Teams
              </p>
              <p className="text-2xl font-bold text-text-light dark:text-text-dark">
                {teams.length}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Total Funds
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(teams.reduce((sum, team) => sum + team.pounds, 0))}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Total Contributions
              </p>
              <p className="text-2xl font-bold text-text-light dark:text-text-dark">
                {teams.reduce((sum, team) => sum + team.count, 0)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
