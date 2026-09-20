import { useEffect, useState, useMemo } from "react";
import { Trophy, Users, User, Leaf, Hash, Search, ChevronDown } from "lucide-react";

import { API_URL } from "../utils/apiUrl";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPounds = (lbs) => {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(2)}M lbs`;
  if (lbs >= 1_000) return `${(lbs / 1_000).toFixed(1)}K lbs`;
  return `${lbs.toFixed(0)} lbs`;
};

const formatPoundsFull = (lbs) =>
  new Intl.NumberFormat("en-US").format(Math.round(lbs)) + " lbs";

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex flex-col items-center bg-white dark:bg-slate-800 rounded-xl px-4 py-3 border border-gray-100 dark:border-slate-700 shadow-sm min-w-[100px]">
      <Icon className={`w-4 h-4 mb-1 ${accent}`} />
      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{label}</span>
      <span className={`text-base font-bold ${accent}`}>{value}</span>
    </div>
  );
}

function RankBadge({ rank }) {
  if (rank <= 3) {
    return <span className="text-2xl leading-none">{MEDAL[rank]}</span>;
  }
  return (
    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700 text-xs font-bold text-gray-500 dark:text-gray-400">
      {rank}
    </span>
  );
}

function LeaderboardCard({ entry, rank, sortBy }) {
  const isTop3 = rank <= 3;
  const secondaryLabel = sortBy === "count" ? "lbs CO₂" : "offsets";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        isTop3
          ? "bg-gradient-to-r from-amber-50 to-yellow-50/40 dark:from-amber-900/20 dark:to-yellow-900/10 border border-amber-200/60 dark:border-amber-700/40 shadow-sm"
          : "bg-white dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/60 hover:border-green-200 dark:hover:border-green-700/50 hover:shadow-sm"
      }`}
    >
      <div className="flex-shrink-0 w-8 flex justify-center">
        <RankBadge rank={rank} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-text-light dark:text-text-dark truncate leading-tight">
          {entry.team}
        </p>
        {entry.region && (
          <span className="inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 leading-none">
            {entry.region}
          </span>
        )}
      </div>

      <div className="flex-shrink-0 text-right">
        <p
          className="font-bold text-sm text-green-600 dark:text-green-400 leading-tight"
          title={sortBy === "pounds" ? formatPoundsFull(entry.pounds) : undefined}
        >
          {sortBy === "count"
            ? entry.count.toLocaleString()
            : formatPounds(entry.pounds)}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
          {secondaryLabel}:{" "}
          {sortBy === "count"
            ? formatPounds(entry.pounds)
            : entry.count.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function LeaderboardColumn({ title, icon: Icon, data, loading, error, sortBy, onSortChange, accent, emptyLabel }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (e) =>
        e.team.toLowerCase().includes(q) ||
        (e.region && e.region.toLowerCase().includes(q))
    );
  }, [data, search]);

  const totalPounds = data.reduce((s, e) => s + e.pounds, 0);
  const totalCount = data.reduce((s, e) => s + e.count, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Column header */}
      <div className={`rounded-2xl p-5 ${accent.bg} border ${accent.border}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-2 rounded-lg ${accent.iconBg}`}>
            <Icon className={`w-5 h-5 ${accent.icon}`} />
          </div>
          <h2 className="text-lg font-bold text-text-light dark:text-text-dark">{title}</h2>
          <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-white/70 dark:bg-slate-700/60 text-gray-600 dark:text-gray-300">
            {data.length}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex gap-2 flex-wrap">
          <StatPill
            icon={Leaf}
            label="Total CO₂"
            value={formatPounds(totalPounds)}
            accent={accent.icon}
          />
          <StatPill
            icon={Hash}
            label="Offsets"
            value={totalCount.toLocaleString()}
            accent={accent.icon}
          />
        </div>
      </div>

      {/* Sort + Search controls */}
      <div className="flex gap-2">
        <div className="flex rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden text-sm font-medium">
          <button
            onClick={() => onSortChange("pounds")}
            className={`px-3 py-1.5 transition-colors ${
              sortBy === "pounds"
                ? `${accent.activeBtn} text-white`
                : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700"
            }`}
          >
            CO₂ lbs
          </button>
          <button
            onClick={() => onSortChange("count")}
            className={`px-3 py-1.5 transition-colors border-l border-gray-200 dark:border-slate-700 ${
              sortBy === "count"
                ? `${accent.activeBtn} text-white`
                : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700"
            }`}
          >
            Count
          </button>
        </div>

        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or region…"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-light dark:text-text-dark placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-400"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2">
        {loading && (
          <div className="flex justify-center py-12">
            <div className={`animate-spin rounded-full h-10 w-10 border-b-2 ${accent.spinner}`} />
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center py-10 text-gray-400 dark:text-gray-600">
            <Icon className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">{search ? "No matches found" : emptyLabel}</p>
          </div>
        )}

        {!loading && !error &&
          filtered.map((entry, i) => (
            <LeaderboardCard
              key={entry.team}
              entry={entry}
              rank={i + 1}
              sortBy={sortBy}
            />
          ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Leaderboard({ onNavigate }) {
  const [teams, setTeams] = useState([]);
  const [individuals, setIndividuals] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingIndividuals, setLoadingIndividuals] = useState(true);
  const [errorTeams, setErrorTeams] = useState(null);
  const [errorIndividuals, setErrorIndividuals] = useState(null);

  const [teamSort, setTeamSort] = useState("pounds");
  const [individualSort, setIndividualSort] = useState("pounds");
  const [regionFilter, setRegionFilter] = useState("all");
  const [allRegions, setAllRegions] = useState([]);

  // Apply region filter
  const filterByRegion = (data) =>
    regionFilter === "all" ? data : data.filter((e) => e.region === regionFilter);

  // Fetch and sort helpers
  const fetchColumn = async (type, sortField, setData, setLoading, setError) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/teams?type=${type}&order=${sortField}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(`Could not load data — ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchColumn("team", teamSort, setTeams, setLoadingTeams, setErrorTeams);
    fetchColumn("individual", individualSort, setIndividuals, setLoadingIndividuals, setErrorIndividuals);

    fetch(`${API_URL}/api/regions`)
      .then((r) => r.json())
      .then((data) => setAllRegions(data.map((r) => r.name).sort()))
      .catch(() => {}); // non-critical — filter just won't appear
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when sort changes (server does the ordering)
  const handleTeamSort = (s) => {
    setTeamSort(s);
    fetchColumn("team", s, setTeams, setLoadingTeams, setErrorTeams);
  };

  const handleIndividualSort = (s) => {
    setIndividualSort(s);
    fetchColumn("individual", s, setIndividuals, setLoadingIndividuals, setErrorIndividuals);
  };

  const totalPounds = [...teams, ...individuals].reduce((s, e) => s + e.pounds, 0);
  const totalCount = [...teams, ...individuals].reduce((s, e) => s + e.count, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-teal-50/20 dark:from-background-dark dark:via-slate-900 dark:to-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">

        {/* Page header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            <Trophy className="w-3.5 h-3.5" />
            Carbon Offset Leaders
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-text-light dark:text-text-dark mb-2">
            Leaderboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto text-sm">
            Celebrating the teams and individuals making the biggest impact on our carbon offset initiative.
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate("join")}
              className="mt-4 inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-colors"
            >
              <Users className="w-4 h-4" />
              Join the Carbon Race
            </button>
          )}
        </div>

        {/* Global summary bar */}
        {!loadingTeams && !loadingIndividuals && (
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <StatPill
              icon={Users}
              label="Teams"
              value={teams.length}
              accent="text-green-600 dark:text-green-400"
            />
            <StatPill
              icon={User}
              label="Individuals"
              value={individuals.length}
              accent="text-teal-600 dark:text-teal-400"
            />
            <StatPill
              icon={Leaf}
              label="Total CO₂ offset"
              value={formatPounds(totalPounds)}
              accent="text-emerald-600 dark:text-emerald-400"
            />
            <StatPill
              icon={Hash}
              label="Total offsets"
              value={totalCount.toLocaleString()}
              accent="text-sky-600 dark:text-sky-400"
            />
          </div>
        )}

        {/* Region filter */}
        {allRegions.length > 0 && (
          <div className="flex justify-center mb-8">
            <div className="relative inline-block">
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="appearance-none pl-4 pr-8 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-green-500/40 cursor-pointer"
              >
                <option value="all">All regions</option>
                {allRegions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
        )}

        {/* Two-column leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LeaderboardColumn
            title="Teams"
            icon={Users}
            data={filterByRegion(teams)}
            loading={loadingTeams}
            error={errorTeams}
            sortBy={teamSort}
            onSortChange={handleTeamSort}
            emptyLabel="No teams yet"
            accent={{
              bg: "bg-gradient-to-br from-green-50 to-emerald-50/60 dark:from-green-900/20 dark:to-emerald-900/10",
              border: "border-green-200/70 dark:border-green-700/40",
              iconBg: "bg-green-100 dark:bg-green-900/40",
              icon: "text-green-600 dark:text-green-400",
              activeBtn: "bg-green-600",
              spinner: "border-green-600",
            }}
          />

          <LeaderboardColumn
            title="Individuals"
            icon={User}
            data={filterByRegion(individuals)}
            loading={loadingIndividuals}
            error={errorIndividuals}
            sortBy={individualSort}
            onSortChange={handleIndividualSort}
            emptyLabel="No individual accounts yet"
            accent={{
              bg: "bg-gradient-to-br from-teal-50 to-sky-50/60 dark:from-teal-900/20 dark:to-sky-900/10",
              border: "border-teal-200/70 dark:border-teal-700/40",
              iconBg: "bg-teal-100 dark:bg-teal-900/40",
              icon: "text-teal-600 dark:text-teal-400",
              activeBtn: "bg-teal-600",
              spinner: "border-teal-600",
            }}
          />
        </div>
      </div>
    </div>
  );
}
