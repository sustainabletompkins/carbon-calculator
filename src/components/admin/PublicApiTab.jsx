import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { adminJson } from "../../utils/adminApi";
import { Button, Card, Alert, FormField, Input } from "../ui";
import { fmtMoney, fmtInt, fmtDate } from "./format";

/**
 * Settings behind the public stat counters that fingerlakesclimatefund.org
 * reads from /api/public/stats (see docs/PUBLIC_API.md).
 *
 * Published = what this site's ledger adds up to (`computed`) + a `baseline`
 * the fund sets once at cutover, so the counters carry over the old site's
 * published totals instead of restarting from the imported records. Grants
 * awarded has no collection behind it and is simply kept current here.
 */

const blank = { grantsAwarded: 0, lbsPerGallon: 20, baseline: { pounds: 0, dollars: 0, offsets: 0 } };

function Counter({ label, value, sub }) {
  return (
    <Card compact className="text-center">
      <p className="text-3xl font-bold text-text">{value}</p>
      <p className="text-sm font-semibold text-text mt-1">{label}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </Card>
  );
}

export default function PublicApiTab() {
  const { getToken } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(blank);
  const [target, setTarget] = useState({ pounds: "", dollars: "", offsets: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const apply = (payload) => {
    setData(payload);
    setForm({
      grantsAwarded: payload.settings.grantsAwarded,
      lbsPerGallon: payload.settings.lbsPerGallon,
      baseline: { ...payload.settings.baseline },
    });
  };

  const load = useCallback(async () => {
    try {
      apply(await adminJson(getToken, "/api/admin/public-stats"));
    } catch (err) {
      setError(err.message);
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      apply(await adminJson(getToken, "/api/admin/public-stats", { method: "PUT", body: form }));
      setNotice("Saved. The public counters update within a few minutes.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /** Turn "what the old site shows" into the baseline that reproduces it. */
  const matchOldSite = () => {
    const n = (v) => (v === "" ? null : Number(String(v).replace(/[$,\s]/g, "")));
    const next = { ...form.baseline };
    for (const key of ["pounds", "dollars", "offsets"]) {
      const want = n(target[key]);
      if (want === null || !Number.isFinite(want)) continue;
      next[key] = Math.round((want - data.computed[key]) * 100) / 100;
    }
    setForm({ ...form, baseline: next });
    setNotice("Baseline filled in from those totals — review it, then Save.");
  };

  if (error && !data) return <Alert variant="error" title="Could not load these settings">{error}</Alert>;
  if (!data) return <p className="text-muted">Loading…</p>;

  const origin = window.location.origin;
  const setBaseline = (key, value) => setForm({ ...form, baseline: { ...form.baseline, [key]: value } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-text">Public API</h2>
        <p className="text-muted">
          The numbers and leaderboards other sites — fingerlakesclimatefund.org above all — read from this one.
        </p>
      </div>

      {notice && <Alert variant="success" onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}

      <section>
        <h3 className="text-lg font-semibold text-text mb-3">Showing on the fund's site right now</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Counter label="Lbs CO₂ Offset" value={fmtInt(data.published.poundsOffset)} sub={`${fmtInt(data.published.offsetCount)} offsets`} />
          <Counter label="Gallons Gas Avoided" value={fmtInt(data.published.gallonsGasAvoided)} sub={`${form.lbsPerGallon} lbs CO₂ per gallon`} />
          <Counter label="$ In Offsets Raised" value={fmtMoney(data.published.dollarsRaised)} />
          <Counter label="Grants Awarded" value={fmtInt(data.published.grantsAwarded)} sub="kept up to date below" />
        </div>
      </section>

      <Card>
        <h3 className="text-lg font-semibold text-text">Counter settings</h3>
        <p className="text-sm text-muted mt-1 mb-4">
          This site's records add up to {fmtInt(Math.round(data.computed.pounds))} lbs, {fmtMoney(data.computed.dollars)} and{" "}
          {fmtInt(data.computed.offsets)} offsets. The baseline below is added to those totals before they are published.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Grants awarded" helpText="No record of grants lives in this site, so keep this current by hand.">
            <Input
              type="number"
              min="0"
              step="1"
              value={form.grantsAwarded}
              onChange={(e) => setForm({ ...form, grantsAwarded: e.target.value })}
            />
          </FormField>
          <FormField label="Lbs CO₂ per gallon of gas" helpText="Used for the gallons-avoided counter. EPA's figure is 19.6; the car calculator uses 19.64.">
            <Input
              type="number"
              min="1"
              step="0.1"
              value={form.lbsPerGallon}
              onChange={(e) => setForm({ ...form, lbsPerGallon: e.target.value })}
            />
          </FormField>
        </div>

        <h4 className="font-semibold text-text mt-6 mb-1">Baseline</h4>
        <p className="text-sm text-muted mb-3">
          Added to this site's own totals. Set it once at cutover so the counters continue the old site's numbers rather
          than restarting from the imported records. It can be negative.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Lbs CO₂">
            <Input type="number" step="1" value={form.baseline.pounds} onChange={(e) => setBaseline("pounds", e.target.value)} />
          </FormField>
          <FormField label="Dollars">
            <Input type="number" step="0.01" value={form.baseline.dollars} onChange={(e) => setBaseline("dollars", e.target.value)} />
          </FormField>
          <FormField label="Offsets">
            <Input type="number" step="1" value={form.baseline.offsets} onChange={(e) => setBaseline("offsets", e.target.value)} />
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-6">
          <Button onClick={save} loading={saving}>Save</Button>
          <Button variant="ghost" onClick={load} disabled={saving}>Discard changes</Button>
          {data.settings.updatedAt && (
            <span className="text-sm text-muted">
              Last saved {fmtDate(data.settings.updatedAt)}
              {data.settings.updatedBy ? ` by ${data.settings.updatedBy}` : ""}
            </span>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-text">Match the old site's numbers</h3>
        <p className="text-sm text-muted mt-1 mb-4">
          Type in what fingerlakesclimatefund.org shows today and this works out the baseline that reproduces it. Leave a
          box empty to leave that baseline alone.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Lbs CO₂ offset">
            <Input inputMode="numeric" placeholder="26,278,461" value={target.pounds} onChange={(e) => setTarget({ ...target, pounds: e.target.value })} />
          </FormField>
          <FormField label="$ in offsets raised">
            <Input inputMode="numeric" placeholder="325,623" value={target.dollars} onChange={(e) => setTarget({ ...target, dollars: e.target.value })} />
          </FormField>
          <FormField label="Number of offsets">
            <Input inputMode="numeric" placeholder="optional" value={target.offsets} onChange={(e) => setTarget({ ...target, offsets: e.target.value })} />
          </FormField>
        </div>
        <Button variant="outline" className="mt-4" onClick={matchOldSite}>Work out the baseline</Button>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-text">Endpoints</h3>
        <p className="text-sm text-muted mt-1 mb-3">
          Open to any site, no key needed, cached for a few minutes. Full documentation is in{" "}
          <code className="text-xs">docs/PUBLIC_API.md</code>.
        </p>
        <ul className="flex flex-col gap-2 text-sm">
          {[
            ["Headline stats", "/api/public/stats"],
            ["Team leaderboard", "/api/public/leaderboard?type=teams&limit=10"],
            ["Individual leaderboard", "/api/public/leaderboard?type=individuals&limit=10"],
            ["Filtered by region", "/api/public/leaderboard?region=tompkins"],
            ["Regions for a filter menu", "/api/public/regions"],
          ].map(([label, path]) => (
            <li key={path} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-text">{label}</span>
              <a className="text-secondary underline break-all" href={`${origin}${path}`} target="_blank" rel="noreferrer">
                {origin}
                {path}
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
