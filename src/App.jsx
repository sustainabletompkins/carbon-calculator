import "./App.css";
import CarbonCalculator from "./components/CarbonCalculator";

function App() {
  return (
    <div className="w-full h-screen bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark overflow-auto">
      <CarbonCalculator />
    </div>
  );
}

export default App;
