import { useState, useEffect } from "react";
import "./App.css";
import CarbonCalculator from "./components/CarbonCalculator";
import Leaderboard from "./components/Leaderboard";
import JoinRace from "./components/race/JoinRace";
import FirestoreTest from "./components/FirestoreTest";
import { CartToast } from "./components/ui/CartToast";
import AdminPage from "./components/admin/AdminPage";

const PAGES = ["calculator", "leaderboard", "join", "test", "admin"];

function pageFromPath() {
  const slug = window.location.pathname.replace(/^\/+|\/+$/g, "");
  return PAGES.includes(slug) ? slug : "calculator";
}

function App() {
  const [currentPage, setCurrentPageState] = useState(pageFromPath);

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
    <div className="w-full bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark overflow-auto">
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
