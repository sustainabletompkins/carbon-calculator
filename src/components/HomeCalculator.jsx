import { useState, useContext } from "react";
import { CartContext } from "../contexts/CartContext";

const HomeCalculator = ({ setActiveTab }) => {
  const [propane, setPropane] = useState("");
  const [naturalGas, setNaturalGas] = useState("");
  const [electricity, setElectricity] = useState("");
  const [fuelOil, setFuelOil] = useState("");
  const [timeframe, setTimeframe] = useState("monthly");
  const [co2, setCo2] = useState(0);
  const [cost, setCost] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const { addToCart } = useContext(CartContext);

  const calculateEmissions = () => {
    // Validate at least one input
    const propaneVal = parseFloat(propane) || 0;
    const naturalGasVal = parseFloat(naturalGas) || 0;
    const electricityVal = parseFloat(electricity) || 0;
    const fuelOilVal = parseFloat(fuelOil) || 0;

    if (
      propaneVal === 0 &&
      naturalGasVal === 0 &&
      electricityVal === 0 &&
      fuelOilVal === 0
    ) {
      alert("Please enter at least one energy usage value");
      return;
    }

    setIsCalculating(true);

    // Emission factors (kg CO2 per unit)
    // Propane: ~5.68 kg CO2 per gallon
    // Natural Gas: ~5.3 kg CO2 per therm (100 cubic feet)
    // Electricity: ~0.92 kg CO2 per kWh (US average)
    // Fuel Oil: ~10.2 kg CO2 per gallon

    let totalCo2 = 0;
    totalCo2 += propaneVal * 5.68;
    totalCo2 += naturalGasVal * 5.3;
    totalCo2 += electricityVal * 0.92;
    totalCo2 += fuelOilVal * 10.2;

    // Multiply by timeframe
    const multiplier = timeframe === "monthly" ? 1 : 12;
    totalCo2 *= multiplier;

    setCo2(totalCo2);
    const calculatedCost = calculateCost(totalCo2);

    // Automatically add to cart
    addToCart({
      origin: "Home Energy",
      destination: timeframe === "monthly" ? "Monthly Usage" : "Annual Usage",
      distance: 0,
      co2: totalCo2,
      cost: calculatedCost,
      tripMode: "home",
      details: {
        propane: propaneVal,
        naturalGas: naturalGasVal,
        electricity: electricityVal,
        fuelOil: fuelOilVal,
        timeframe,
      },
    });

    setIsCalculating(false);

    // Navigate to cart
    setActiveTab("cart");
  };

  const calculateCost = (co2) => {
    const costPerKg = 0.01;
    const calculatedCost = co2 * costPerKg;
    setCost(calculatedCost);
    return calculatedCost;
  };

  return (
    <main className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold mb-2 text-text-light dark:text-text-dark">
          Home Energy Carbon Offset
        </h2>
        <p className="text-sm sm:text-base text-muted-light dark:text-muted-dark">
          Calculate your carbon footprint from home energy usage
        </p>
      </div>

      <div className="mb-6 sm:mb-8">
        <h3 className="text-lg font-semibold mb-4 text-center text-text-light dark:text-text-dark">
          Enter your energy use
        </h3>
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={() => setTimeframe("monthly")}
            className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 ${
              timeframe === "monthly"
                ? "bg-gradient-to-r from-primary to-secondary text-white shadow-md"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setTimeframe("annual")}
            className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 ${
              timeframe === "annual"
                ? "bg-gradient-to-r from-primary to-secondary text-white shadow-md"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Annual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div>
          <label
            className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-2"
            htmlFor="propane"
          >
            Propane (gallons)
          </label>
          <input
            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary text-text-light dark:text-text-dark px-4 py-3 text-lg"
            id="propane"
            name="propane"
            placeholder="propane (gallons)"
            type="number"
            min="0"
            step="0.1"
            value={propane}
            onChange={(e) => setPropane(e.target.value)}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-2"
            htmlFor="natural-gas"
          >
            Natural Gas (therms)
          </label>
          <input
            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary text-text-light dark:text-text-dark px-4 py-3 text-lg"
            id="natural-gas"
            name="natural-gas"
            placeholder="natural gas (therms)"
            type="number"
            min="0"
            step="0.1"
            value={naturalGas}
            onChange={(e) => setNaturalGas(e.target.value)}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-2"
            htmlFor="electricity"
          >
            Electricity (kWh)
          </label>
          <input
            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary text-text-light dark:text-text-dark px-4 py-3 text-lg"
            id="electricity"
            name="electricity"
            placeholder="electricity (kWh)"
            type="number"
            min="0"
            step="0.1"
            value={electricity}
            onChange={(e) => setElectricity(e.target.value)}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-2"
            htmlFor="fuel-oil"
          >
            Fuel Oil (gallons)
          </label>
          <input
            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary text-text-light dark:text-text-dark px-4 py-3 text-lg"
            id="fuel-oil"
            name="fuel-oil"
            placeholder="fuel oil (gallons)"
            type="number"
            min="0"
            step="0.1"
            value={fuelOil}
            onChange={(e) => setFuelOil(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4 mb-6 sm:mb-8">
        <div className="flex items-start gap-2 sm:gap-3">
          <span className="material-icons text-blue-600 dark:text-blue-400 text-lg sm:text-xl">
            info
          </span>
          <div className="flex-1">
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
              <strong>Tip:</strong> You can find these values on your utility
              bills. Enter only the energy sources you use.
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              • Propane &amp; Fuel Oil: measured in gallons
              <br />
              • Natural Gas: measured in therms (or CCF - 100 cubic feet)
              <br />• Electricity: measured in kilowatt-hours (kWh)
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 sm:pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-3 border-2 border-transparent text-base font-semibold rounded-lg shadow-md text-white bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200"
          type="button"
          onClick={calculateEmissions}
          disabled={isCalculating}
        >
          {isCalculating ? (
            <>
              <span className="material-icons animate-spin mr-2">refresh</span>
              Calculating...
            </>
          ) : (
            <>
              <span className="material-icons mr-2">add_shopping_cart</span>
              Calculate & Add to Cart
            </>
          )}
        </button>
        <p className="text-sm text-muted-light dark:text-muted-dark text-center sm:text-right">
          Or, send check to Sustainable Finger Lakes / 309 N Aurora / Ithaca, NY
          14850 with 'FLCF' in memo line
        </p>
      </div>
    </main>
  );
};

export default HomeCalculator;
