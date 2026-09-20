import { useState, useEffect } from "react";
import "./App.css";
import CarbonCalculator from "./components/CarbonCalculator";
import Leaderboard from "./components/Leaderboard";
import JoinRace from "./components/race/JoinRace";
import FirestoreTest from "./components/FirestoreTest";
import { CartToast } from "./components/ui/CartToast";
import AdminPage from "./components/admin/AdminPage";
import { useAuth } from "./contexts/AuthContext";

const PAGES = ["calculator", "leaderboard", "join", "test", "admin"];

function pageFromPath() {
  const slug = window.location.pathname.replace(/^\/+|\/+$/g, "");
  return PAGES.includes(slug) ? slug : "calculator";
}

/** Nav tab. `shortLabel` keeps the bar from overflowing on narrow screens. */
function NavButton({ active, onClick, label, shortLabel }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap px-2.5 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
        active
          ? "bg-green-600 text-white"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
      }`}
    >
      <span className="sm:hidden">{shortLabel || label}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function App() {
  const [currentPage, setCurrentPageState] = useState(pageFromPath);
  const { isAdmin } = useAuth();

  // Keep the URL in sync so /admin is linkable and survives reloads.
  const setCurrentPage = (page) => {
    setCurrentPageState(page);
    const path = page === "calculator" ? "/" : `/${page}`;
    if (window.location.pathname !== path)
      window.history.pushState({}, "", path);
  };

  useEffect(() => {
    const onPop = () => setCurrentPageState(pageFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <div className="w-full min-h-screen bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark overflow-auto">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center gap-2 h-16">
            {/* Abbreviated on phones so the tabs — including "Join" — all fit. */}
            <div className="shrink-0 font-bold text-base sm:text-xl text-text-light dark:text-text-dark">
              <span className="sm:hidden">Carbon</span>
              <span className="hidden sm:inline">Carbon Calculator</span>
            </div>
            <div className="flex gap-1 sm:gap-2 overflow-x-auto">
              <NavButton
                active={currentPage === "calculator"}
                onClick={() => setCurrentPage("calculator")}
                label="Calculator"
                shortLabel="Offset"
              />
              <NavButton
                active={currentPage === "leaderboard"}
                onClick={() => setCurrentPage("leaderboard")}
                label="Leaderboard"
                shortLabel="Board"
              />
              <NavButton
                active={currentPage === "join"}
                onClick={() => setCurrentPage("join")}
                label="Join the Race"
                shortLabel="Join"
              />
              {isAdmin && (
                <NavButton
                  active={currentPage === "admin"}
                  onClick={() => setCurrentPage("admin")}
                  label="Admin"
                />
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <div>
        {currentPage === "calculator" && <CarbonCalculator />}
        {currentPage === "leaderboard" && <Leaderboard onNavigate={setCurrentPage} />}
        {currentPage === "join" && <JoinRace onNavigate={setCurrentPage} />}
        {currentPage === "test" && <FirestoreTest />}
        {currentPage === "admin" && <AdminPage />}
      </div>

      <CartToast />
    </div>
  );
}

export default App;
