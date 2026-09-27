import { useState, useContext } from "react";
import LocationInput from "./LocationInput";
import useGoogleMaps from "../hooks/useGoogleMaps";
import { greatCircleMiles } from "../utils/geo";
import { CartContext } from "../contexts/CartContext";
import { PageHeader } from "./ui";

const AirCalculator = ({ setActiveTab }) => {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [manualMiles, setManualMiles] = useState("");
  const [travelers, setTravelers] = useState("1");
  const [flightClass, setFlightClass] = useState("economy");
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [distance, setDistance] = useState(0);
  const [co2, setCo2] = useState(0);
  const [cost, setCost] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const google = useGoogleMaps();
  const { addToCart } = useContext(CartContext);

  const calculateDistance = async () => {
    if (!origin || !destination) {
      alert("Please select both origin and destination airports");
      return;
    }

    setIsCalculating(true);

    try {
      // Flights go straight, so use the great-circle distance rather than a
      // driving route (which doesn't exist across oceans).
      let distanceInMiles = greatCircleMiles(origin, destination);

      if (isRoundTrip) {
        distanceInMiles *= 2;
      }

      setDistance(distanceInMiles);
      const { co2: calculatedCo2, cost: calculatedCost } =
        calculateEmissions(distanceInMiles);

      // Automatically add to cart
      const numTravelers = parseInt(travelers) || 1;
      addToCart({
        origin: origin?.description || "Manual Entry",
        destination: destination?.description || "",
        distance: distanceInMiles,
        co2: calculatedCo2,
        cost: calculatedCost,
        tripMode: "air",
        travelers: numTravelers,
        flightClass,
      });

      // Navigate to cart
      setActiveTab("cart");
    } catch (error) {
      console.error("Distance calculation failed:", error);
      alert(`Error calculating distance: ${error.message}`);
    } finally {
      setIsCalculating(false);
    }
  };

  const calculateFromManualMiles = () => {
    const miles = parseFloat(manualMiles);
    if (isNaN(miles) || miles <= 0) {
      alert("Please enter a valid mileage");
      return;
    }

    let totalMiles = miles;
    if (isRoundTrip) {
      totalMiles *= 2;
    }

    setDistance(totalMiles);
    const { co2: calculatedCo2, cost: calculatedCost } =
      calculateEmissions(totalMiles);

    // Automatically add to cart
    const numTravelers = parseInt(travelers) || 1;
    addToCart({
      origin: "Manual Entry",
      destination: "",
      distance: totalMiles,
      co2: calculatedCo2,
      cost: calculatedCost,
      tripMode: "air",
      travelers: numTravelers,
      flightClass,
    });

    // Navigate to cart
    setActiveTab("cart");
  };

  const calculateEmissions = (distance) => {
    // Air travel emissions vary by class and distance
    // Short-haul (<500 mi): higher emissions per mile
    // Long-haul (>500 mi): lower emissions per mile

    let co2PerMilePerPerson;
    const isLongHaul = distance > 500;

    if (flightClass === "economy") {
      co2PerMilePerPerson = isLongHaul ? 0.18 : 0.24;
    } else if (flightClass === "business") {
      co2PerMilePerPerson = isLongHaul ? 0.43 : 0.58;
    } else {
      // first class
      co2PerMilePerPerson = isLongHaul ? 0.64 : 0.86;
    }

    const numTravelers = parseInt(travelers) || 1;
    const calculatedCo2 = distance * co2PerMilePerPerson * numTravelers;

    setCo2(calculatedCo2);
    const calculatedCost = calculateCost(calculatedCo2);
    return { co2: calculatedCo2, cost: calculatedCost };
  };

  const calculateCost = (co2) => {
    const costPerKg = 0.01;
    const calculatedCost = co2 * costPerKg;
    setCost(calculatedCost);
    return calculatedCost;
  };

  const handleAddToCart = () => {
    const item = {
      origin: origin?.description || "Manual Entry",
      destination: destination?.description || "",
      distance,
      co2,
      cost,
      tripMode: "air",
      travelers: parseInt(travelers),
      flightClass,
    };
    addToCart(item);
    setAddedToCart(true);
  };

  return (
    <main className="p-3 sm:p-4 max-w-6xl mx-auto">
      <PageHeader
        title="Air Travel Carbon Offset"
        subtitle="Calculate your carbon footprint from air travel"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div>
          <label
            className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-2"
            htmlFor="travelers"
          >
            How many travelers?
          </label>
          <input
            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary text-text-light dark:text-text-dark px-4 py-2"
            id="travelers"
            name="travelers"
            type="number"
            min="1"
            value={travelers}
            onChange={(e) => setTravelers(e.target.value)}
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-2"
            htmlFor="flight-class"
          >
            Flight class
          </label>
          <select
            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary text-text-light dark:text-text-dark px-4 py-2"
            id="flight-class"
            name="flight-class"
            value={flightClass}
            onChange={(e) => setFlightClass(e.target.value)}
          >
            <option value="economy">Economy</option>
            <option value="business">Business</option>
            <option value="first">First Class</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 items-start">
        <div className="bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-800 dark:to-gray-700 border-2 border-secondary/30 dark:border-gray-600 rounded-lg p-4 sm:p-6 shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-lg font-semibold mb-4 text-center text-text-light dark:text-text-dark flex items-center justify-center gap-2">
            <span className="material-icons text-primary">edit</span>
            Enter trip mileage
          </h2>
          <input
            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary text-text-light dark:text-text-dark px-4 py-2"
            id="total-miles"
            name="total-miles"
            placeholder="total miles"
            type="text"
            value={manualMiles}
            onChange={(e) => setManualMiles(e.target.value)}
          />
        </div>
        <div className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 border-2 border-primary/30 dark:border-gray-600 rounded-lg p-4 sm:p-6 shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-lg font-semibold mb-4 text-center text-text-light dark:text-text-dark flex items-center justify-center gap-2">
            <span className="material-icons text-secondary">map</span>
            Or, let us calculate it
          </h2>
          <div className="grid grid-cols-1 gap-6">
            <LocationInput
              setOrigin={setOrigin}
              setDestination={setDestination}
              airportsOnly
              placeholder={{
                origin: "starting location",
                destination: "end location",
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 sm:mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-2 border-blue-300 dark:border-blue-700 flex items-center gap-3">
        <input
          className="h-5 w-5 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded"
          id="round-trip-air"
          name="round-trip"
          type="checkbox"
          checked={isRoundTrip}
          onChange={(e) => setIsRoundTrip(e.target.checked)}
        />
        <label
          className="block text-base font-medium text-text-light dark:text-text-dark cursor-pointer"
          htmlFor="round-trip-air"
        >
          Round trip?
        </label>
      </div>

      <div className="mt-6 sm:mt-8 border-t border-gray-200 dark:border-gray-700 pt-4 sm:pt-6 flex flex-col items-center gap-4">
        <button
          className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-3 border-2 border-transparent text-base font-semibold rounded-lg shadow-md text-white bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200"
          type="button"
          onClick={manualMiles ? calculateFromManualMiles : calculateDistance}
          disabled={
            (!manualMiles && (!origin || !destination)) || isCalculating
          }
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
        <p className="text-sm text-muted-light dark:text-muted-dark text-center">
          Or, send check to Sustainable Finger Lakes / 309 N Aurora / Ithaca, NY
          14850 with 'FLCF' in memo line
        </p>
      </div>
    </main>
  );
};

export default AirCalculator;
