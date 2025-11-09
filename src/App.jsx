import { useState } from "react";
import "./App.css";
import CarbonCalculator from "./components/CarbonCalculator";
import Leaderboard from "./components/Leaderboard";

function App() {
  const [currentPage, setCurrentPage] = useState("calculator");

  return (
    <div className="w-full min-h-screen bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark overflow-auto">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="font-bold text-xl text-text-light dark:text-text-dark">
              Carbon Calculator
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage("calculator")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentPage === "calculator"
                    ? "bg-green-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                }`}
              >
                Calculator
              </button>
              <button
                onClick={() => setCurrentPage("leaderboard")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentPage === "leaderboard"
                    ? "bg-green-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                }`}
              >
                Leaderboard
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <div>
        {currentPage === "calculator" && <CarbonCalculator />}
        {currentPage === "leaderboard" && <Leaderboard />}
      </div>
    </div>
  );
}

export default App;
