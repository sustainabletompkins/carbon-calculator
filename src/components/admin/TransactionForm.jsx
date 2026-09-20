import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { adminJson } from "../../utils/adminApi";
import { Button, FormField, Input, Select, Textarea, Alert } from "../ui";
import Modal from "./Modal";
import { PAYMENT_METHODS, toDateInput } from "./format";

// Same rate the public calculators charge (costPerKg = 0.01). Only used to
// suggest a value; the admin can type any number.
const COST_PER_KG = 0.01;
const LBS_PER_KG = 2.20462;
const suggestPounds = (dollars) => Math.round((dollars / COST_PER_KG) * LBS_PER_KG);

/**
 * Add a manual offset/donation, or edit any existing ledger record.
 * `record` = existing row to edit; otherwise `defaultKind` picks the new type.
 */
export default function TransactionForm({ record, defaultKind = "offset", onClose, onSaved }) {
  const { getToken } = useAuth();
  const editing = Boolean(record);
  const [teams, setTeams] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    kind: record?.kind || defaultKind,
    date: record ? toDateInput(record.date) : toDateInput(new Date().toISOString()),
    name: record?.name || "",
    email: record?.email || "",
    zipCode: record?.zipCode || "",
    cost: record ? String(record.cost) : "",
    pounds: record && record.kind === "offset" ? String(Math.round(record.pounds * 100) / 100) : "",
    // Imported records have no payment method; don't invent one on edit.
    paymentMethod: record ? record.paymentMethod || "" : "check",
    teamDocId: record?.teamDocId || "",
    description: record?.description || "",
    note: record?.note || "",
    syncToLGL: false,
  });
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const isOffset = form.kind === "offset";

  useEffect(() => {
    adminJson(getToken, "/api/admin/teams").then(setTeams).catch(() => setTeams([]));
  }, [getToken]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        kind: form.kind,
        date: form.date,
        name: form.name,
        email: form.email,
        zipCode: form.zipCode,
        cost: form.cost === "" ? 0 : Number(form.cost),
        pounds: isOffset ? Number(form.pounds) : 0,
        paymentMethod: form.paymentMethod || undefined,
        teamDocId: isOffset ? form.teamDocId || null : null,
        description: form.description,
        note: form.note,
      };
      if (editing) {
        await adminJson(getToken, `/api/admin/transactions/${record.id}`, { method: "PATCH", body });
      } else {
        await adminJson(getToken, "/api/admin/transactions", {
          method: "POST",
          body: { ...body, syncToLGL: form.syncToLGL },
        });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const suggestion = isOffset && Number(form.cost) > 0 ? suggestPounds(Number(form.cost)) : null;
  const groupTeams = teams.filter((t) => !t.isIndividual);
  const individuals = teams.filter((t) => t.isIndividual);

  return (
    <Modal
      title={editing ? `Edit ${record.kind}` : isOffset ? "Add offset manually" : "Add donation"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}

        {!editing && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Entry type">
            {[
              ["offset", "Carbon offset", "Counts toward CO₂ totals"],
              ["donation", "Donation", "Money only, no CO₂"],
            ].map(([value, label, hint]) => (
              <button
                type="button"
                key={value}
                role="radio"
                aria-checked={form.kind === value}
                onClick={() => setForm((f) => ({ ...f, kind: value }))}
                className={`text-left rounded-md border-2 px-4 py-3 cursor-pointer transition-colors ${
                  form.kind === value ? "border-primary bg-primary-tint" : "border-border hover:border-primary"
                }`}
              >
                <span className="block font-semibold text-text">{label}</span>
                <span className="block text-sm text-muted">{hint}</span>
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Date" required>
            <Input type="date" value={form.date} onChange={set("date")} max={toDateInput(new Date().toISOString())} required />
          </FormField>
          <FormField label="Payment method">
            <Select value={form.paymentMethod} onChange={set("paymentMethod")}>
              {editing && !record.paymentMethod && <option value="">Not recorded</option>}
              {PAYMENT_METHODS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Name">
            <Input value={form.name} onChange={set("name")} placeholder="Donor or organization" />
          </FormField>
          <FormField label="Email">
            <Input type="email" value={form.email} onChange={set("email")} placeholder="optional" />
          </FormField>
          <FormField label="Amount (USD)" required={!isOffset}>
            <Input type="number" min="0" step="0.01" value={form.cost} onChange={set("cost")} required={!isOffset} />
          </FormField>
          {isOffset ? (
            <FormField
              label="Pounds of CO₂"
              required
              helpText={suggestion ? `At the website rate this amount offsets about ${suggestion.toLocaleString()} lbs` : undefined}
            >
              <Input type="number" min="0" step="any" value={form.pounds} onChange={set("pounds")} required />
            </FormField>
          ) : (
            <FormField label="ZIP code">
              <Input value={form.zipCode} onChange={set("zipCode")} maxLength={10} />
            </FormField>
          )}
        </div>

        {isOffset && suggestion && form.pounds === "" && (
          <button
            type="button"
            className="self-start text-sm text-secondary underline cursor-pointer"
            onClick={() => setForm((f) => ({ ...f, pounds: String(suggestion) }))}
          >
            Use {suggestion.toLocaleString()} lbs
          </button>
        )}

        {isOffset && (
          <FormField label="Credit to Carbon Race team" helpText="Adds this offset to the team's pounds, dollars and offset count.">
            <Select value={form.teamDocId} onChange={set("teamDocId")}>
              <option value="">No team</option>
              {groupTeams.length > 0 && (
                <optgroup label="Teams">
                  {groupTeams.map((t) => <option key={t.docId} value={t.docId}>{t.name}</option>)}
                </optgroup>
              )}
              {individuals.length > 0 && (
                <optgroup label="Individuals">
                  {individuals.map((t) => <option key={t.docId} value={t.docId}>{t.name}</option>)}
                </optgroup>
              )}
            </Select>
          </FormField>
        )}

        <FormField label="Description" helpText="Shown in the log. Leave blank for a default.">
          <Input value={form.description} onChange={set("description")} />
        </FormField>
        <FormField label="Internal note">
          <Textarea value={form.note} onChange={set("note")} placeholder="Check number, context, etc." />
        </FormField>

        {!editing && (
          <label className="flex items-start gap-3 text-sm text-text cursor-pointer">
            <input type="checkbox" checked={form.syncToLGL} onChange={set("syncToLGL")} className="mt-1" />
            <span>
              <span className="font-semibold">Also send to Little Green Light</span>
              <span className="block text-muted">Leave off if this gift is already recorded there.</span>
            </span>
          </label>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{editing ? "Save changes" : "Add entry"}</Button>
        </div>
      </form>
    </Modal>
  );
}
