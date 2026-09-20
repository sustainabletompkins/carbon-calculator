import { useCallback, useContext, useEffect, useState } from "react";
import { Trophy, Users, User, Leaf } from "lucide-react";
import { Alert, Button, Card, CardHeader, Confetti, FormField, Input } from "../ui";
import { CartContext } from "../../contexts/CartContext";
import { getMyAccounts, listRegions } from "../../utils/raceApi";
import AccountForm from "./AccountForm";
import TeamPicker from "./TeamPicker";

const EMAIL_STORAGE_KEY = "carbonRaceEmail";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatPounds = (lbs) =>
  lbs >= 1000 ? `${(lbs / 1000).toFixed(1)}K lbs` : `${Math.round(lbs)} lbs`;

/** One row in "Your Carbon Race accounts". */
function AccountRow({ account }) {
  const Icon = account.isIndividual ? User : Users;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="shrink-0 p-2 rounded-lg bg-primary-tint">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-text-light dark:text-text-dark truncate leading-tight">
          {account.name}
        </p>
        <p className="text-[11px] text-muted mt-0.5">
          {[
            account.isIndividual ? "Individual" : "Team",
            account.founder ? "Founder" : null,
            account.regionName,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-bold text-sm text-primary leading-tight">
          {formatPounds(account.pounds)}
        </p>
        <p className="text-[10px] text-subtle leading-tight">
          {account.count} offset{account.count === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

/** One of the three things a visitor can do from here. */
function ActionCard({ icon, title, description, onClick, disabled, disabledNote }) {
  const Glyph = icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left p-4 rounded-xl border-2 transition-all ${
        disabled
          ? "border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 cursor-not-allowed"
          : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary hover:shadow-sm cursor-pointer"
      }`}
    >
      <Glyph className={`w-6 h-6 mb-2 ${disabled ? "text-subtle" : "text-primary"}`} />
      <p className="font-semibold text-sm text-text-light dark:text-text-dark leading-tight">
        {title}
      </p>
      <p className="text-xs text-muted mt-1">{disabled ? disabledNote : description}</p>
    </button>
  );
}

/**
 * "Join the Carbon Race" — the visitor-facing way onto the leaderboard.
 *
 * Until this existed an account could only be created by an admin, so someone
 * could buy an offset with nothing to credit it to. Everything keys off an
 * email address, the same identity the cart and checkout use: enter one, see
 * what it's already attached to, then join a team, start one, or register as
 * an individual. Being on a team never rules out starting another.
 */
export default function JoinRace({ onNavigate }) {
  const { userEmail } = useContext(CartContext);

  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState(null);
  const [emailError, setEmailError] = useState("");

  const [accounts, setAccounts] = useState(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState(null);

  const [regions, setRegions] = useState([]);
  const [view, setView] = useState(null); // null | "join" | "team" | "individual"
  const [success, setSuccess] = useState(null);

  // Remember the address across visits, and pick up one already typed into
  // the cart, so returning here doesn't mean typing it again.
  useEffect(() => {
    const remembered = userEmail || localStorage.getItem(EMAIL_STORAGE_KEY) || "";
    if (remembered) {
      setEmailInput(remembered);
      setEmail(remembered);
    }
  }, [userEmail]);

  useEffect(() => {
    listRegions()
      .then(setRegions)
      .catch(() => {}); // non-critical — the region select just stays empty
  }, []);

  const loadAccounts = useCallback(async (addr) => {
    setLoadingAccounts(true);
    setAccountsError(null);
    try {
      setAccounts(await getMyAccounts(addr));
    } catch (err) {
      setAccountsError(err.message);
      setAccounts(null);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    if (email) loadAccounts(email);
  }, [email, loadAccounts]);

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    const addr = emailInput.trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError("");
    localStorage.setItem(EMAIL_STORAGE_KEY, addr);
    setEmail(addr);
    setSuccess(null);
    setView(null);
  };

  const finish = (message) => {
    setSuccess(message);
    setView(null);
    loadAccounts(email);
  };

  const memberOfDocIds = accounts?.teams?.map((t) => t.docId) ?? [];
  const hasIndividual = Boolean(accounts?.individual);
  const allAccounts = accounts
    ? [...(accounts.individual ? [accounts.individual] : []), ...accounts.teams]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-teal-50/20 dark:from-background-dark dark:via-slate-900 dark:to-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">

        {/* Page header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            <Trophy className="w-3.5 h-3.5" />
            Carbon Race
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-text-light dark:text-text-dark mb-2">
            Join the Carbon Race
          </h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto text-sm">
            Compete as a team or on your own. Every offset you buy is credited to the account you
            pick at checkout and counts toward its place on the leaderboard.
          </p>
        </div>

        {/* ── Step 1: who are you? ───────────────────────────────────────── */}
        {!email ? (
          <Card className="text-left">
            <CardHeader
              title="Start with your email"
              subtitle="It's how your offsets get matched to your team — no password needed."
              icon="mail"
            />
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
              <FormField label="Email address" required error={emailError}>
                <Input
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setEmailError("");
                  }}
                  placeholder="your.email@example.com"
                  autoFocus
                />
              </FormField>
              <Button type="submit">
                <span aria-hidden="true" className="material-icons" style={{ fontSize: "20px" }}>arrow_forward</span>
                Continue
              </Button>
            </form>
          </Card>
        ) : (
          <>
            {/* ── Your accounts ──────────────────────────────────────────── */}
            <Card className="text-left">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-text leading-snug">
                    Your Carbon Race accounts
                  </h3>
                  <p className="text-sm text-muted mt-0.5 truncate">{email}</p>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setEmail(null);
                    setAccounts(null);
                    setSuccess(null);
                    setView(null);
                  }}
                >
                  Change
                </Button>
              </div>

              {loadingAccounts && (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              )}

              {accountsError && (
                <Alert variant="error">Could not load your accounts — {accountsError}</Alert>
              )}

              {!loadingAccounts && !accountsError && allAccounts.length === 0 && (
                <Alert variant="info" title="You're not in the race yet">
                  Join an existing team, start your own, or register as an individual below.
                </Alert>
              )}

              {!loadingAccounts && allAccounts.length > 0 && (
                <div className="flex flex-col gap-2">
                  {allAccounts.map((account) => (
                    <AccountRow key={account.docId} account={account} />
                  ))}
                </div>
              )}
            </Card>

            {/* ── Success ────────────────────────────────────────────────── */}
            {success && (
              <div className="text-left">
                <Confetti key={success} count={30} />
                <Alert variant="success" title="You're in!" onClose={() => setSuccess(null)}>
                  {success}
                </Alert>
              </div>
            )}

            {/* ── What next? ─────────────────────────────────────────────── */}
            {view === null && (
              <Card className="text-left">
                <CardHeader
                  title={allAccounts.length > 0 ? "Add another account" : "Pick how you'll compete"}
                  subtitle="You can be on as many teams as you like, and still have your own entry."
                  icon="flag"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ActionCard
                    icon={Users}
                    title="Join a team"
                    description="Add yourself to a team that's already racing."
                    onClick={() => setView("join")}
                  />
                  <ActionCard
                    icon={Leaf}
                    title="Start a team"
                    description="Create a new team and become its founding member."
                    onClick={() => setView("team")}
                  />
                  <ActionCard
                    icon={User}
                    title="Race solo"
                    description="Register as an individual on the leaderboard."
                    onClick={() => setView("individual")}
                    disabled={hasIndividual}
                    disabledNote={`You already race as "${accounts?.individual?.name}".`}
                  />
                </div>

                {onNavigate && (
                  <div className="mt-5 pt-4 border-t border-border flex flex-wrap gap-3">
                    <Button variant="ghost" size="sm" onClick={() => onNavigate("leaderboard")}>
                      <span aria-hidden="true" className="material-icons" style={{ fontSize: "18px" }}>leaderboard</span>
                      See the leaderboard
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onNavigate("calculator")}>
                      <span aria-hidden="true" className="material-icons" style={{ fontSize: "18px" }}>calculate</span>
                      Offset a trip
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {view === "join" && (
              <Card className="text-left">
                <CardHeader
                  title="Join a team"
                  subtitle="Find the team you belong to and add yourself to it."
                  icon="group_add"
                />
                <TeamPicker
                  email={email}
                  memberOfDocIds={memberOfDocIds}
                  onCancel={() => setView(null)}
                  onJoined={(team) => finish(`You've joined ${team.name}.`)}
                />
              </Card>
            )}

            {(view === "team" || view === "individual") && (
              <Card className="text-left">
                <CardHeader
                  title={view === "team" ? "Start a team" : "Race as an individual"}
                  subtitle={
                    view === "team"
                      ? "Your team appears on the leaderboard as soon as it's created."
                      : "Your own entry on the individuals leaderboard."
                  }
                  icon={view === "team" ? "groups" : "person_add"}
                />
                <AccountForm
                  mode={view === "team" ? "team" : "individual"}
                  email={email}
                  regions={regions}
                  onCancel={() => setView(null)}
                  onCreated={(created) =>
                    finish(
                      created.isIndividual
                        ? `${created.name} is on the individuals leaderboard.`
                        : `${created.name} is on the leaderboard — invite others to join it.`
                    )
                  }
                />
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
