import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { adminJson } from "../../utils/adminApi";
import { Button, Card, Alert, Input, Select } from "../ui";
import TeamEditor from "./TeamEditor";
import { fmtMoney, fmtPounds, fmtInt } from "./format";

export default function TeamsTab() {
  const { getToken } = useAuth();
  const [teams, setTeams] = useState(null);
  const [regions, setRegions] = useState([]);
  const [type, setType] = useState("team");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState(null); // {team} | {team:null} | null
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    try {
      setTeams(await adminJson(getToken, "/api/admin/teams"));
    } catch (err) {
      setError(err.message);
    }
  }, [getToken]);

  useEffect(() => {
    load();
    adminJson(getToken, "/api/admin/regions").then(setRegions).catch(() => {});
  }, [load, getToken]);

  const visible = useMemo(() => {
    if (!teams) return [];
    const q = search.trim().toLowerCase();
    return teams
      .filter((t) => (type === "individual" ? t.isIndividual : !t.isIndividual))
      .filter((t) => !q || t.name.toLowerCase().includes(q) || (t.regionName || "").toLowerCase().includes(q) || t.email.toLowerCase().includes(q));
  }, [teams, type, search]);

  const totals = visible.reduce(
    (s, t) => ({ pounds: s.pounds + t.pounds, count: s.count + t.count, dollars: s.dollars + t.totalDollars }),
    { pounds: 0, count: 0, dollars: 0 }
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-text">Carbon Race teams</h2>
          <p className="text-muted">View and correct the teams and totals shown on the public leaderboard.</p>
        </div>
        <Button size="sm" onClick={() => setEditor({ team: null })}>New team</Button>
      </div>

      {notice && <Alert variant="success" onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}

      <Card compact>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <Input type="search" placeholder="Search by name, region or email…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search teams" />
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Account type">
            <option value="team">Teams</option>
            <option value="individual">Individuals</option>
          </Select>
        </div>
      </Card>

      {teams && (
        <p className="text-sm text-muted">
          <span className="font-semibold text-text">{fmtInt(visible.length)}</span> {type === "individual" ? "individuals" : "teams"} ·{" "}
          <span className="font-semibold text-text">{fmtPounds(totals.pounds)}</span> ·{" "}
          <span className="font-semibold text-text">{fmtInt(totals.count)}</span> offsets ·{" "}
          <span className="font-semibold text-text">{fmtMoney(totals.dollars)}</span> tracked
        </p>
      )}

      <Card compact className="overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Region</th>
              <th className="px-4 py-3 font-semibold text-right">Members</th>
              <th className="px-4 py-3 font-semibold text-right">CO₂</th>
              <th className="px-4 py-3 font-semibold text-right">Offsets</th>
              <th className="px-4 py-3 font-semibold text-right">Dollars</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {!teams && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">Loading…</td></tr>}
            {teams && visible.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">
                {type === "individual" && !search ? "No individual accounts have been set up yet." : "Nothing matches that search."}
              </td></tr>
            )}
            {visible.map((t, i) => (
              <tr key={t.docId} className="border-b border-border last:border-0 hover:bg-primary-tint/40">
                <td className="px-4 py-3 text-muted">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-text">{t.name}</div>
                  {t.email && <div className="text-muted break-all">{t.email}</div>}
                </td>
                <td className="px-4 py-3 text-text">{t.regionName || "—"}</td>
                <td className="px-4 py-3 text-right text-text">{fmtInt(t.membersCount)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-text">{fmtPounds(t.pounds)}</td>
                <td className="px-4 py-3 text-right text-text">{fmtInt(t.count)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap text-text">{fmtMoney(t.totalDollars)}</td>
                <td className="px-4 py-3 text-right">
                  <button className="text-secondary hover:underline cursor-pointer" onClick={() => setEditor({ team: t })}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editor && (
        <TeamEditor
          team={editor.team}
          regions={regions}
          onClose={() => setEditor(null)}
          onChanged={(message, close) => {
            if (message) setNotice(message);
            if (close) setEditor(null);
            load();
          }}
        />
      )}
    </div>
  );
}
