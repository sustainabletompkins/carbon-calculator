import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { adminJson } from "../../utils/adminApi";
import { Card, Alert } from "../ui";
import { fmtDate, fmtMoney, fmtPounds, fmtInt, SOURCE_LABELS } from "./format";

function Stat({ label, value, sub }) {
  return (
    <Card compact>
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl sm:text-3xl font-bold text-text mt-1">{value}</p>
      {sub && <p className="text-sm text-muted mt-1">{sub}</p>}
    </Card>
  );
}

export default function OverviewTab({ onNavigate }) {
  const { getToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    adminJson(getToken, "/api/admin/stats")
      .then((d) => !cancelled && setStats(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  if (error) return <Alert variant="error" title="Could not load the overview">{error}</Alert>;
  if (!stats) return <p className="text-muted">Loading…</p>;

  const year = new Date().getFullYear();
  const { allTime, thisYear, bySource } = stats;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-lg font-semibold text-text mb-3">{year} so far</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="CO₂ offset" value={fmtPounds(thisYear.offsets.pounds + thisYear.donations.pounds)} sub={`${fmtInt(thisYear.offsets.count)} offsets`} />
          <Stat label="Offset revenue" value={fmtMoney(thisYear.offsets.dollars)} />
          <Stat label="Donations" value={fmtMoney(thisYear.donations.dollars)} sub={`${fmtInt(thisYear.donations.count)} gifts`} />
          <Stat label="Total raised" value={fmtMoney(thisYear.offsets.dollars + thisYear.donations.dollars)} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text mb-3">All time</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="CO₂ offset" value={fmtPounds(allTime.offsets.pounds + allTime.donations.pounds)} sub={`${fmtInt(allTime.offsets.count)} offsets`} />
          <Stat label="Offset revenue" value={fmtMoney(allTime.offsets.dollars)} />
          <Stat label="Donations" value={fmtMoney(allTime.donations.dollars)} sub={`${fmtInt(allTime.donations.count)} gifts`} />
          <Stat label="Carbon Race teams" value={fmtInt(stats.teams)} sub={`${fmtInt(stats.users)} website users`} />
        </div>
        <p className="text-sm text-muted mt-3">
          Records by source: {["website", "manual", "legacy"].map((s) => `${SOURCE_LABELS[s]} ${fmtInt(bySource[s].count)}`).join(" · ")}
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-text">Latest activity</h2>
          <button className="text-sm text-secondary underline cursor-pointer" onClick={() => onNavigate("offsets")}>View full log</button>
        </div>
        <Card compact className="!p-0">
          <ul className="divide-y divide-border text-sm">
            {stats.recent.length === 0 && <li className="px-4 py-6 text-center text-muted">No activity yet.</li>}
            {stats.recent.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-3">
                <span className="text-text">
                  <span className="text-muted">{fmtDate(r.date)}</span> · <span className="font-semibold">{r.name || r.email || "Anonymous"}</span>{" "}
                  <span className="text-muted">({r.kind === "donation" ? "donation" : SOURCE_LABELS[r.source].toLowerCase() + " offset"})</span>
                </span>
                <span className="text-text whitespace-nowrap">
                  {r.pounds > 0 && `${fmtPounds(r.pounds)} · `}<span className="font-semibold">{fmtMoney(r.cost)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
