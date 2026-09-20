import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Alert, Button } from "../ui";
import { joinTeam, listTeams } from "../../utils/raceApi";

const formatPounds = (lbs) =>
  lbs >= 1000 ? `${(lbs / 1000).toFixed(1)}K lbs` : `${Math.round(lbs)} lbs`;

/**
 * Searchable list of every team, for joining one. Teams the visitor is
 * already on stay in the list — seeing them is the answer to "am I on this
 * one already?" — but can't be selected.
 */
export default function TeamPicker({ email, memberOfDocIds, onJoined, onCancel }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listTeams()
      .then((data) => !cancelled && setTeams(data))
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.regionName && t.regionName.toLowerCase().includes(q))
    );
  }, [teams, search]);

  const handleJoin = async () => {
    if (!selected) return;
    setJoinError(null);
    setJoining(true);
    try {
      await joinTeam(selected.docId, { email, name: name.trim() });
      onJoined(selected);
    } catch (err) {
      setJoinError(err.message);
      setJoining(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search teams by name or region…"
          className="w-full has-leading-icon"
          aria-label="Search teams"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {loadError && <Alert variant="error">Could not load teams — {loadError}</Alert>}

      {!loading && !loadError && (
        <div className="max-h-80 overflow-y-auto flex flex-col gap-2 pr-1">
          {filtered.length === 0 && (
            <p className="text-sm text-muted text-center py-8">
              No teams match “{search}”. You can start one instead.
            </p>
          )}

          {filtered.map((team) => {
            const alreadyOn = memberOfDocIds.includes(team.docId);
            const isSelected = selected?.docId === team.docId;
            return (
              <label
                key={team.docId}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  alreadyOn
                    ? "border-border bg-primary-tint/40 cursor-default"
                    : isSelected
                      ? "border-primary bg-primary-tint shadow-sm cursor-pointer"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 hover:border-primary/40 cursor-pointer"
                }`}
              >
                <input
                  type="radio"
                  name="team"
                  checked={isSelected}
                  disabled={alreadyOn}
                  onChange={() => setSelected(team)}
                  className="accent-green-600 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-text-light dark:text-text-dark truncate leading-tight">
                    {team.name}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {[
                      team.regionName,
                      `${team.membersCount || 0} member${team.membersCount === 1 ? "" : "s"}`,
                      team.pounds > 0 ? `${formatPounds(team.pounds)} offset` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {alreadyOn && (
                  <span className="shrink-0 text-[11px] font-semibold text-primary bg-primary-tint px-2 py-0.5 rounded-full">
                    Already joined
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="join-name" className="text-sm font-semibold text-text leading-tight">
            Your name
          </label>
          <input
            id="join-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            maxLength={200}
          />
          <p className="text-sm text-muted">Optional — how you appear on {selected.name}'s roster.</p>
        </div>
      )}

      {joinError && <Alert variant="error">{joinError}</Alert>}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleJoin} disabled={!selected} loading={joining} className="flex-1">
          <span aria-hidden="true" className="material-icons" style={{ fontSize: "20px" }}>group_add</span>
          {selected ? `Join ${selected.name}` : "Select a team"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={joining}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
