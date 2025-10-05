import { useState } from "react";
import TripModeSelector from "./TripModeSelector";
import LocationInput from "./LocationInput";
import useGoogleMaps from "../hooks/useGoogleMaps";
import { computeRoute, getTravelMode } from "../utils/routesApi";

const CarbonCalculator = () => {
  const [tripMode, setTripMode] = useState("car");
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [distance, setDistance] = useState(0);
  const [co2, setCo2] = useState(0);
  const [cost, setCost] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const google = useGoogleMaps();

  const calculateDistance = async () => {
    if (!origin || !destination) {
      alert("Please select both origin and destination locations");
      return;
    }

    setIsCalculating(true);
    console.log("Origin:", origin);
    console.log("Destination:", destination);

    try {
      const travelMode = getTravelMode(tripMode);
      const apiKey = "AIzaSyB5FKv-bUndJIx7zRFJw8sPXzjVqhRof0M"; // TODO: Move to environment variable

      const routeResult = await computeRoute(
        origin,
        destination,
        travelMode,
        apiKey
      );

      if (routeResult.success) {
        const distanceInMiles = routeResult.distanceMiles;
        setDistance(distanceInMiles);
        calculateEmissions(distanceInMiles);
        console.log("Route calculated successfully:", {
          distance: `${distanceInMiles.toFixed(2)} miles`,
          duration: routeResult.duration,
        });
      } else {
        console.error("Route calculation failed:", routeResult.error);
        alert(`Unable to calculate route: ${routeResult.error}`);
      }
    } catch (error) {
      console.error("Distance calculation failed:", error);
      alert(`Error calculating distance: ${error.message}`);
    } finally {
      setIsCalculating(false);
    }
  };

  const calculateEmissions = (distance) => {
    // TODO: Implement correct emission factors
    const co2PerMile = tripMode === "car" ? 0.404 : 0.217;
    const calculatedCo2 = distance * co2PerMile;
    setCo2(calculatedCo2);
    calculateCost(calculatedCo2);
  };

  const calculateCost = (co2) => {
    // TODO: Implement correct cost calculation
    const costPerKg = 0.01;
    const calculatedCost = co2 * costPerKg;
    setCost(calculatedCost);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
      <TripModeSelector tripMode={tripMode} setTripMode={setTripMode} />
      <div className="mt-8">
        <LocationInput setOrigin={setOrigin} setDestination={setDestination} />
        <button
          onClick={calculateDistance}
          disabled={!origin || !destination || isCalculating}
          className="w-full mt-4 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isCalculating ? "Calculating..." : "Calculate Emissions"}
        </button>
      </div>

      {distance > 0 && (
        <div className="mt-8 text-center">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-lg font-bold">{distance.toFixed(2)} miles</p>
              <p className="text-sm text-gray-600">Distance</p>
            </div>
            <div>
              <p className="text-lg font-bold">{co2.toFixed(2)} kg</p>
              <p className="text-sm text-gray-600">CO2 Emissions</p>
            </div>
            <div>
              <p className="text-lg font-bold">${cost.toFixed(2)}</p>
              <p className="text-sm text-gray-600">Offset Cost</p>
            </div>
          </div>
          <button className="mt-8 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
            Offset Now with Stripe
          </button>
        </div>
      )}
    </div>
  );
};

export default CarbonCalculator;
