import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { adminJson, qs } from "../../utils/adminApi";
import { Button, FormField, Input, Select, Alert } from "../ui";
import Modal from "./Modal";
import { fmtDate, fmtMoney, fmtPounds, fmtInt } from "./format";

// Stored totals are float sums (1787364.4000000004); show them to the cent.
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Create (`team` = null) or edit a Carbon Race team / individual account. */
export default function TeamEditor({ team, regions, onClose, onChanged }) {
  const { getToken } = useAuth();
  const creating = !team;
  const [form, setForm] = useState({
    name: team?.name || "",
    email: team?.email || "",
    isIndividual: team?.isIndividual || false,
    regionId: team?.regionId ?? "",
    pounds: String(round2(team?.pounds)),
    count: String(team?.count ?? 0),
    totalDollars: String(round2(team?.totalDollars)),
  });
  const [tab, setTab] = useState("details");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [members, setMembers] = useState(null);
  const [offsets, setOffsets] = useState(null);
  const [recalc, setRecalc] = useState(null);
  const [newMember, setNewMember] = useState({ name: "", email: "" });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const base = team ? `/api/admin/teams/${team.docId}` : null;

  const loadDetails = useCallback(async () => {
    if (!base) return;
    try {
      const [m, o] = await Promise.all([
        team.isIndividual ? Promise.resolve([]) : adminJson(getToken, `${base}/members`),
        adminJson(getToken, `/api/admin/transactions${qs({ teamDocId: team.docId, pageSize: 10 })}`),
      ]);
      setMembers(m);
      setOffsets(o);
    } catch (err) {
      setError(err.message);
    }
  }, [base, getToken, team]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        email: form.email,
        regionId: form.regionId === "" ? null : Number(form.regionId),
        pounds: Number(form.pounds),
        count: Number(form.count),
        totalDollars: Number(form.totalDollars),
      };
      if (creating) {
        await adminJson(getToken, "/api/admin/teams", { method: "POST", body: { ...body, isIndividual: form.isIndividual } });
      } else {
        await adminJson(getToken, base, { method: "PATCH", body });
      }
      onChanged(creating ? "Team created." : "Team saved.", true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const checkTotals = async () => {
    setError(null);
    try {
      setRecalc(await adminJson(getToken, `${base}/recalculate`));
    } catch (err) {
      setError(err.message);
    }
  };

  const applyTotals = async () => {
    if (!window.confirm("Replace this team's stored totals with the totals calculated from the log?")) return;
    try {
      const t = await adminJson(getToken, `${base}/recalculate`, { method: "POST" });
      setForm((f) => ({ ...f, pounds: String(round2(t.pounds)), count: String(t.count), totalDollars: String(round2(t.totalDollars)) }));
      setRecalc(null);
      setNotice("Totals updated from the log.");
      onChanged(null, false);
    } catch (err) {
      setError(err.message);
    }
  };

  const addMember = async () => {
    setError(null);
    try {
      await adminJson(getToken, `${base}/members`, { method: "POST", body: newMember });
      setNewMember({ name: "", email: "" });
      loadDetails();
      onChanged(null, false);
    } catch (err) {
      setError(err.message);
    }
  };

  const removeMember = async (m) => {
    if (!window.confirm(`Remove ${m.name || m.email} from this team?`)) return;
    try {
      await adminJson(getToken, `${base}/members/${m.id}`, { method: "DELETE" });
      loadDetails();
      onChanged(null, false);
    } catch (err) {
      setError(err.message);
    }
  };

  const removeTeam = async () => {
    if (!window.confirm(`Delete "${team.name}"? This cannot be undone.`)) return;
    try {
      await adminJson(getToken, base, { method: "DELETE" });
      onChanged("Team deleted.", true);
    } catch (err) {
      setError(err.message);
    }
  };

  const tabs = [
    ["details", "Details"],
    ...(!creating && !team.isIndividual ? [["members", `Members${members ? ` (${fmtInt(members.length)})` : ""}`]] : []),
    ...(!creating ? [["offsets", `Offsets${offsets ? ` (${fmtInt(offsets.total)})` : ""}`]] : []),
  ];

  return (
    <Modal title={creating ? "New team" : team.name} onClose={onClose} wide>
      <div className="flex flex-col gap-6">
        {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}
        {notice && <Alert variant="success" onClose={() => setNotice(null)}>{notice}</Alert>}

        {tabs.length > 1 && (
          <div role="tablist" aria-label="Team sections" className="flex gap-1 overflow-x-auto border-b border-border -mt-2">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`px-4 py-2 font-semibold whitespace-nowrap border-b-2 -mb-px cursor-pointer transition-colors ${
                  tab === id ? "border-primary text-text" : "border-transparent text-muted hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {tab === "details" && (
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Name" required>
              <Input value={form.name} onChange={set("name")} required />
            </FormField>
            <FormField label="Region">
              <Select value={form.regionId} onChange={set("regionId")}>
                <option value="">No region</option>
                {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </FormField>
            {creating && (
              <FormField label="Account type">
                <Select value={form.isIndividual ? "individual" : "team"} onChange={(e) => setForm((f) => ({ ...f, isIndividual: e.target.value === "individual" }))}>
                  <option value="team">Team</option>
                  <option value="individual">Individual</option>
                </Select>
              </FormField>
            )}
            {(form.isIndividual || team?.isIndividual) && (
              <FormField label="Email" helpText="Website purchases with this email are credited automatically.">
                <Input type="email" value={form.email} onChange={set("email")} />
              </FormField>
            )}
          </div>

          <fieldset className="border border-border rounded-md p-4">
            <legend className="px-2 text-sm font-semibold text-text">Leaderboard totals</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Pounds of CO₂">
                <Input type="number" min="0" step="any" value={form.pounds} onChange={set("pounds")} />
              </FormField>
              <FormField label="Number of offsets">
                <Input type="number" min="0" step="1" value={form.count} onChange={set("count")} />
              </FormField>
              <FormField label="Dollars">
                <Input type="number" min="0" step="0.01" value={form.totalDollars} onChange={set("totalDollars")} />
              </FormField>
            </div>
            <p className="text-sm text-muted mt-3">
              These update on their own when offsets are credited to the team. Edit them only to make a correction.
            </p>
            {!creating && (
              <div className="mt-3">
                <button type="button" onClick={checkTotals} className="text-sm text-secondary underline cursor-pointer">
                  Compare with the offsets log
                </button>
                {recalc && (
                  <div className="mt-3 rounded-md bg-secondary-tint p-3 text-sm text-text">
                    <p>
                      The log has <strong>{fmtInt(recalc.computed.records)}</strong> records for this team:{" "}
                      <strong>{fmtPounds(recalc.computed.pounds)}</strong>, <strong>{fmtInt(recalc.computed.count)}</strong> offsets,{" "}
                      <strong>{fmtMoney(recalc.computed.totalDollars)}</strong>.
                    </p>
                    <Button type="button" size="sm" variant="outline" className="mt-2" onClick={applyTotals}>
                      Use the log&apos;s totals
                    </Button>
                  </div>
                )}
              </div>
            )}
          </fieldset>

          <div className="flex flex-wrap justify-between gap-3">
            {!creating ? (
              <Button type="button" variant="link" className="!text-error" onClick={removeTeam}>Delete team</Button>
            ) : <span />}
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
              <Button type="submit" loading={saving}>{creating ? "Create team" : "Save changes"}</Button>
            </div>
          </div>
        </form>
        )}

        {tab === "members" && (
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-3">
              <Input placeholder="Name" value={newMember.name} onChange={(e) => setNewMember((n) => ({ ...n, name: e.target.value }))} aria-label="New member name" />
              <Input type="email" placeholder="Email" value={newMember.email} onChange={(e) => setNewMember((n) => ({ ...n, email: e.target.value }))} aria-label="New member email" />
              <Button type="button" variant="outline" onClick={addMember} disabled={!newMember.email}>Add member</Button>
            </div>
            {members === null ? (
              <p className="text-muted text-sm">Loading…</p>
            ) : (
              <ul className="divide-y divide-border border border-border rounded-md max-h-[55vh] overflow-y-auto">
                {members.length === 0 && <li className="px-3 py-3 text-sm text-muted">No members yet.</li>}
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold text-text">{m.name || "—"}</span>
                      {m.founder && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary-tint text-primary-hover font-semibold">Founder</span>}
                      <span className="block text-muted break-all">{m.email}</span>
                    </span>
                    <button onClick={() => removeMember(m)} className="text-error hover:underline cursor-pointer shrink-0">Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "offsets" && (
          <section>
            {!offsets ? (
              <p className="text-muted text-sm">Loading…</p>
            ) : offsets.rows.length === 0 ? (
              <p className="text-sm text-muted">Nothing in the log is credited to this team yet.</p>
            ) : (
              <>
              <p className="text-sm text-muted mb-2">
                The {fmtInt(offsets.rows.length)} most recent of {fmtInt(offsets.total)}. The Offsets log has the full list.
              </p>
              <ul className="divide-y divide-border border border-border rounded-md text-sm">
                {offsets.rows.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3 px-3 py-2">
                    <span className="text-text">{fmtDate(r.date)} · {r.name || r.email || "—"}</span>
                    <span className="text-muted whitespace-nowrap">{fmtPounds(r.pounds)} · {fmtMoney(r.cost)}</span>
                  </li>
                ))}
              </ul>
              </>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
