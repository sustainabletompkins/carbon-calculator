import { useState, useContext } from "react";
import { CartContext } from "../contexts/CartContext";
import { InfoPopover, PageHeader } from "./ui";
import { COST_PER_LB, LBS_PER_KG, QUICK_OFFSET_LBS_PER_YEAR } from "../../lib/offsetRates.js";

const QuickOffset = ({ setActiveTab }) => {
  const [offsetType, setOffsetType] = useState("");
  const [timePeriod, setTimePeriod] = useState("year");
  const { addToCart } = useContext(CartContext);

  // Yearly CO2 for each typical offset, in lbs. A quarter is a quarter of the
  // year and a month a twelfth.
  const offsetOptions = {
    "home energy": {
      label: "Home Energy",
      icon: "home",
      description: "Average US home's energy use, on the upstate NY grid",
      methodology:
        "Based on the EPA's average US home: 12,194 kWh of electricity at the upstate New York grid rate of 0.242 lbs CO2 per kWh, plus natural gas, propane and heating oil.",
      lbsPerYear: QUICK_OFFSET_LBS_PER_YEAR.home,
    },
    "car travel": {
      label: "Car Travel",
      icon: "directions_car",
      description: "Typical upstate NY driver (12,000 miles per year)",
      methodology:
        "Based on 12,000 miles a year, the upstate New York average, at the EPA's typical 22.8 mpg and 19.64 lbs of CO2 per gallon of gasoline.",
      lbsPerYear: QUICK_OFFSET_LBS_PER_YEAR.car,
    },
    "air travel": {
      label: "Air Travel",
      icon: "flight",
      description: "Typical domestic flyer (2.5 cross-country round trips per year)",
      methodology:
        "Based on 2.5 New York to Los Angeles round trips a year (12,375 miles) at the EPA's 0.359 lbs CO2 per passenger-mile for flights over 2,300 miles.",
      lbsPerYear: QUICK_OFFSET_LBS_PER_YEAR.air,
    },
  };

  const PERIODS_PER_YEAR = { year: 1, quarter: 4, month: 12 };
  const lbsFor = (option) => Math.round(option.lbsPerYear / PERIODS_PER_YEAR[timePeriod]);

  const handleCalculate = () => {
    if (!offsetType) {
      alert("Please select what you want to offset");
      return;
    }

    const option = offsetOptions[offsetType];
    const co2 = lbsFor(option) / LBS_PER_KG;
    const cost = lbsFor(option) * COST_PER_LB;

    // Add to cart
    addToCart({
      origin: "Quick Offset",
      destination: `${option.label} - ${timePeriod}`,
      distance: 0,
      co2: co2,
      cost: cost,
      tripMode: "quick",
      details: {
        offsetType: offsetType,
        timePeriod: timePeriod,
      },
    });

    // Navigate to cart
    setActiveTab("cart");
  };

  const selectedOption = offsetType ? offsetOptions[offsetType] : null;
  const estimatedLbs = selectedOption ? lbsFor(selectedOption) : 0;
  const estimatedCost = estimatedLbs * COST_PER_LB;

  return (
    <main className="p-3 sm:p-4 max-w-4xl mx-auto">
      <PageHeader
        title="Quick Carbon Offset"
        subtitle="Offset your carbon footprint using US average consumption data"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
        {/* What to Offset */}
        <div>
          <label
            className="block text-base sm:text-lg font-semibold text-text-light dark:text-text-dark mb-3"
            htmlFor="offset-type"
          >
            What To Offset?
          </label>
          <select
            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary text-text-light dark:text-text-dark px-4 py-3 text-base"
            id="offset-type"
            name="offset-type"
            value={offsetType}
            onChange={(e) => setOffsetType(e.target.value)}
          >
            <option value="">Select an option...</option>
            <option value="home energy">Home Energy</option>
            <option value="car travel">Car Travel</option>
            <option value="air travel">Air Travel</option>
          </select>
        </div>

        {/* Time Period */}
        <div>
          <label
            className="block text-base sm:text-lg font-semibold text-text-light dark:text-text-dark mb-3"
            htmlFor="time-period"
          >
            For What Period?
          </label>
          <select
            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary text-text-light dark:text-text-dark px-4 py-3 text-base"
            id="time-period"
            name="time-period"
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
          >
            <option value="year">Year</option>
            <option value="quarter">Quarter (3 months)</option>
            <option value="month">Month</option>
          </select>
        </div>
      </div>

      {/* Selected Option Preview */}
      {selectedOption && (
        <div className="mb-6 sm:mb-8 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-lg p-4 sm:p-6 border border-green-200 dark:border-green-800">
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="material-icons text-primary text-3xl sm:text-4xl">
              {selectedOption.icon}
            </span>
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-text-light dark:text-text-dark mb-1">
                {selectedOption.label} Offset
              </h3>
              <p className="text-xs sm:text-sm text-muted-light dark:text-muted-dark mb-3">
                {selectedOption.description}
              </p>
              <div className="grid grid-cols-2 gap-4 bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 sm:p-4">
                <div>
                  <p className="text-xs text-muted-light dark:text-muted-dark mb-1">
                    Estimated CO2
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-primary">
                    {estimatedLbs.toLocaleString()} lbs
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-light dark:text-muted-dark mb-1">
                    Offset Cost
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-primary">
                    ${estimatedCost.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Per{" "}
                  {timePeriod === "year"
                    ? "year"
                    : timePeriod === "quarter"
                    ? "quarter (3 months)"
                    : "month"}
                </p>
                <InfoPopover
                  label="How we calculate"
                  className="shrink-0"
                  title={`How we estimate ${selectedOption.label.toLowerCase()}`}
                >
                  <p>{selectedOption.methodology}</p>
                  {timePeriod !== "year" && (
                    <p>
                      A {timePeriod === "quarter" ? "quarter" : "month"} is that
                      annual estimate divided by{" "}
                      {timePeriod === "quarter" ? "4" : "12"}.
                    </p>
                  )}
                  <p>
                    Offset cost is ${(COST_PER_LB * 2000).toFixed(0)} per ton
                    (2,000 lbs) of CO2, so{" "}
                    {estimatedLbs.toLocaleString()} lbs
                    costs $
                    {estimatedCost.toFixed(2)}.
                  </p>
                </InfoPopover>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calculate Button */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 sm:pt-6 flex flex-col items-center gap-4">
        <button
          className="inline-flex justify-center items-center px-8 py-4 border-2 border-transparent text-lg font-semibold rounded-lg shadow-md text-white bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200"
          type="button"
          onClick={handleCalculate}
          disabled={!offsetType}
        >
          <span className="material-icons mr-2">flash_on</span>
          Calculate & Add to Cart
        </button>
        <p className="text-xs sm:text-sm text-muted-light dark:text-muted-dark text-center">
          Or, send check to Sustainable Finger Lakes / 309 N Aurora / Ithaca, NY
          14850 with 'FLCF' in memo line
        </p>
      </div>
    </main>
  );
};

export default QuickOffset;
