import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { adminFetch, adminJson, qs } from "../../utils/adminApi";
import { Button, Card, Alert, Input, Select } from "../ui";
import TransactionForm from "./TransactionForm";
import { fmtDate, fmtMoney, fmtPounds, fmtInt, SOURCE_LABELS } from "./format";

const SOURCE_STYLES = {
  website: "bg-secondary-tint text-secondary",
  manual: "bg-warning-bg text-warning",
  legacy: "bg-gray-100 text-muted",
};

/**
 * Ledger view. `kind` fixes the tab to "offset" or "donation".
 */
export default function TransactionsTab({ kind }) {
  const { getToken } = useAuth();
  const isDonations = kind === "donation";
  const [filters, setFilters] = useState({ source: "", search: "", from: "", to: "" });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState(null); // {record?} | null
  const [notice, setNotice] = useState(null);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      try {
        const res = await adminJson(
          getToken,
          `/api/admin/transactions${qs({ kind, ...filters, page, pageSize: 50, refresh: refresh ? 1 : "" })}`
        );
        setData(res);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [getToken, kind, filters, page]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput }));
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const setFilter = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };

  const exportCsv = async () => {
    try {
      const res = await adminFetch(getToken, `/api/admin/transactions${qs({ kind, ...filters, format: "csv" })}`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `flcf-${isDonations ? "donations" : "offsets"}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (row) => {
    const warning =
      row.source === "website"
        ? "\n\nThis was a website payment. Deleting it here does NOT refund the charge in Stripe."
        : "";
    const teamNote = row.teamName ? `\n\nIt will also be subtracted from ${row.teamName}'s totals.` : "";
    if (!window.confirm(`Delete this ${row.kind} of ${fmtMoney(row.cost)}${row.name ? ` from ${row.name}` : ""}?${teamNote}${warning}`)) return;
    try {
      await adminJson(getToken, `/api/admin/transactions/${row.id}`, { method: "DELETE" });
      setNotice("Record deleted.");
      load(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-text">{isDonations ? "Donations" : "Offsets log"}</h2>
          <p className="text-muted">
            {isDonations
              ? "Straight donations with no carbon offset attached."
              : "Every offset made on the website, added manually, or imported from the old system."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={exportCsv}>Export CSV</Button>
          <Button size="sm" onClick={() => setFormState({})}>
            {isDonations ? "Add donation" : "Add offset"}
          </Button>
        </div>
      </div>

      {notice && <Alert variant="success" onClose={() => setNotice(null)}>{notice}</Alert>}
      {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}

      <Card compact>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            type="search"
            placeholder="Search name, email, team, note…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search"
          />
          <Select value={filters.source} onChange={setFilter("source")} aria-label="Source">
            <option value="">All sources</option>
            <option value="website">Website</option>
            <option value="manual">Added manually</option>
            <option value="legacy">Imported (old system)</option>
          </Select>
          <Input type="date" value={filters.from} onChange={setFilter("from")} aria-label="From date" />
          <Input type="date" value={filters.to} onChange={setFilter("to")} aria-label="To date" />
        </div>
      </Card>

      {data && (
        <p className="text-sm text-muted">
          <span className="font-semibold text-text">{fmtInt(data.summary.count)}</span> records ·{" "}
          <span className="font-semibold text-text">{fmtMoney(data.summary.dollars)}</span>
          {!isDonations && (
            <> · <span className="font-semibold text-text">{fmtPounds(data.summary.pounds)}</span> CO₂</>
          )}
        </p>
      )}

      <Card compact className="overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">From</th>
              <th className="px-4 py-3 font-semibold">Details</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              {!isDonations && <th className="px-4 py-3 font-semibold text-right">CO₂</th>}
              <th className="px-4 py-3 font-semibold text-right">Amount</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && !data && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">Loading…</td></tr>
            )}
            {data && data.rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No records match these filters.</td></tr>
            )}
            {data?.rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 align-top hover:bg-primary-tint/40">
                <td className="px-4 py-3 whitespace-nowrap text-text">{fmtDate(r.date)}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-text">{r.name || "—"}</div>
                  <div className="text-muted break-all">{r.email}</div>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <div className="text-text">{r.description || "—"}</div>
                  {r.teamName && <div className="text-primary-hover font-semibold">Team: {r.teamName}</div>}
                  {r.note && <div className="text-muted italic">{r.note}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${SOURCE_STYLES[r.source]}`}>
                    {SOURCE_LABELS[r.source]}
                  </span>
                </td>
                {!isDonations && <td className="px-4 py-3 text-right whitespace-nowrap text-text">{fmtPounds(r.pounds)}</td>}
                <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-text">{fmtMoney(r.cost)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <button className="text-secondary hover:underline cursor-pointer mr-3" onClick={() => setFormState({ record: r })}>Edit</button>
                  <button className="text-error hover:underline cursor-pointer" onClick={() => remove(r)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted">Page {page} of {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      {formState && (
        <TransactionForm
          record={formState.record}
          defaultKind={kind}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setNotice(formState.record ? "Changes saved." : "Entry added.");
            setFormState(null);
            load(true);
          }}
        />
      )}
    </div>
  );
}
