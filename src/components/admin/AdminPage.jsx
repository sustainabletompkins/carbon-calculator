import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui";
import RequireAdmin from "./RequireAdmin";
import OverviewTab from "./OverviewTab";
import TransactionsTab from "./TransactionsTab";
import TeamsTab from "./TeamsTab";
import PublicApiTab from "./PublicApiTab";

const TABS = [
  ["overview", "Overview"],
  ["offsets", "Offsets log"],
  ["donations", "Donations"],
  ["teams", "Carbon Race teams"],
  ["public-api", "Public API"],
];

const tabFromHash = () => {
  const h = window.location.hash.replace("#", "");
  return TABS.some(([id]) => id === h) ? h : "overview";
};

function AdminShell() {
  const { user, signOut } = useAuth();
  const [tab, setTabState] = useState(tabFromHash);
  const setTab = (id) => {
    setTabState(id);
    window.history.replaceState({}, "", `${window.location.pathname}#${id}`);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text">Admin</h1>
          <p className="text-muted">Signed in as {user.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
      </div>

      <div role="tablist" aria-label="Admin sections" className="flex gap-1 overflow-x-auto border-b border-border mb-6">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`px-4 py-3 font-semibold whitespace-nowrap border-b-2 -mb-px cursor-pointer transition-colors ${
              tab === id ? "border-primary text-text" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab onNavigate={setTab} />}
      {tab === "offsets" && <TransactionsTab key="offset" kind="offset" />}
      {tab === "donations" && <TransactionsTab key="donation" kind="donation" />}
      {tab === "teams" && <TeamsTab />}
      {tab === "public-api" && <PublicApiTab />}
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAdmin>
      <AdminShell />
    </RequireAdmin>
  );
}
