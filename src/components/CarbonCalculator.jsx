import { useState, useContext } from "react";
import LocationInput from "./LocationInput";
import useGoogleMaps from "../hooks/useGoogleMaps";
import { computeRoute, getTravelMode } from "../utils/routesApi";
import { CartContext } from "../contexts/CartContext";
import { PageHeader } from "./ui";
import AirCalculator from "./AirCalculator";
import HomeCalculator from "./HomeCalculator";
import QuickOffset from "./QuickOffset";
import Cart from "./Cart";
import ThankYou from "./ThankYou";
import { KG_CO2_PER_GALLON_GASOLINE, offsetCost } from "../../lib/offsetRates.js";

// Returns the entered mpg as a number, or null (after alerting) if it isn't
// a usable value.
const parseMpg = (value) => {
  const mpg = parseFloat(value);
  if (isNaN(mpg) || mpg <= 0) {
    alert("Please enter a valid car mpg");
    return null;
  }
  return mpg;
};

const CarCalculator = ({ setActiveTab }) => {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [manualMiles, setManualMiles] = useState("");
  const [carMpg, setCarMpg] = useState("25");
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [distance, setDistance] = useState(0);
  const [co2, setCo2] = useState(0);
  const [cost, setCost] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const google = useGoogleMaps();
  const { addToCart } = useContext(CartContext);

  const calculateDistance = async () => {
    if (!origin || !destination) {
      alert("Please select both origin and destination locations");
      return;
    }
    const mpg = parseMpg(carMpg);
    if (mpg === null) return;

    setIsCalculating(true);

    try {
      const travelMode = getTravelMode("car");
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

      const routeResult = await computeRoute(
        origin,
        destination,
        travelMode,
        apiKey
      );

      if (routeResult.success) {
        let distanceInMiles = routeResult.distanceMiles;
        if (isRoundTrip) {
          distanceInMiles *= 2;
        }
        setDistance(distanceInMiles);
        const { co2: calculatedCo2, cost: calculatedCost } =
          calculateEmissions(distanceInMiles, mpg);

        // Automatically add to cart
        addToCart({
          origin: origin?.description || "Manual Entry",
          destination: destination?.description || "",
          distance: distanceInMiles,
          co2: calculatedCo2,
          cost: calculatedCost,
          tripMode: "car",
        });

        // Navigate to cart
        setActiveTab("cart");
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

  const calculateFromManualMiles = () => {
    const miles = parseFloat(manualMiles);
    if (isNaN(miles) || miles <= 0) {
      alert("Please enter a valid mileage");
      return;
    }
    const mpg = parseMpg(carMpg);
    if (mpg === null) return;

    let totalMiles = miles;
    if (isRoundTrip) {
      totalMiles *= 2;
    }

    setDistance(totalMiles);
    const { co2: calculatedCo2, cost: calculatedCost } =
      calculateEmissions(totalMiles, mpg);

    // Automatically add to cart
    addToCart({
      origin: "Manual Entry",
      destination: "",
      distance: totalMiles,
      co2: calculatedCo2,
      cost: calculatedCost,
      tripMode: "car",
    });

    // Navigate to cart
    setActiveTab("cart");
  };

  const calculateEmissions = (distance, mpg) => {
    const calculatedCo2 = (distance / mpg) * KG_CO2_PER_GALLON_GASOLINE;
    setCo2(calculatedCo2);
    const calculatedCost = calculateCost(calculatedCo2);
    return { co2: calculatedCo2, cost: calculatedCost };
  };

  const calculateCost = (co2) => {
    const calculatedCost = offsetCost(co2);
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
      tripMode: "car",
    };
    addToCart(item);
    setAddedToCart(true);
  };

  return (
    <main className="p-3 sm:p-4 max-w-6xl mx-auto">
      <PageHeader
        title="Car Travel Carbon Offset"
        subtitle="Calculate your carbon footprint from car travel"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        <div className="bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-800 dark:to-gray-700 border-2 border-secondary/30 dark:border-gray-600 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-sm font-semibold mb-2 text-center text-text-light dark:text-text-dark flex items-center justify-center gap-1.5">
            <span className="material-icons text-primary text-base">edit</span>
            Option 1: Enter Mileage
          </h2>
          <input
            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary text-text-light dark:text-text-dark text-sm"
            id="total-miles"
            name="total-miles"
            placeholder="total miles"
            type="text"
            value={manualMiles}
            onChange={(e) => setManualMiles(e.target.value)}
          />
        </div>
        <div className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 border-2 border-primary/30 dark:border-gray-600 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-sm font-semibold mb-2 text-center text-text-light dark:text-text-dark flex items-center justify-center gap-1.5">
            <span className="material-icons text-secondary text-base">map</span>
            Option 2: Calculate Mileage
          </h2>
          <LocationInput
            setOrigin={setOrigin}
            setDestination={setDestination}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <label
            className="text-sm font-medium text-muted-light dark:text-muted-dark whitespace-nowrap"
            htmlFor="car-mpg"
          >
            Car mpg:
          </label>
          <input
            className="w-20 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary focus:border-primary text-text-light dark:text-text-dark text-sm"
            id="car-mpg"
            name="car-mpg"
            type="text"
            value={carMpg}
            onChange={(e) => setCarMpg(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded"
            id="round-trip"
            name="round-trip"
            type="checkbox"
            checked={isRoundTrip}
            onChange={(e) => setIsRoundTrip(e.target.checked)}
          />
          <span className="text-sm font-medium text-text-light dark:text-text-dark">
            Round trip?
          </span>
        </label>
      </div>

      <div className="mt-3 flex flex-col items-center gap-3">
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
        <p className="text-xs text-muted-light dark:text-muted-dark text-center">
          Or, send check to Sustainable Finger Lakes / 309 N Aurora / Ithaca, NY
          14850 with 'FLCF' in memo line
        </p>
      </div>
    </main>
  );
};

const CarbonCalculator = () => {
  const [activeTab, setActiveTab] = useState("car");
  const [paymentDetails, setPaymentDetails] = useState(null);
  const { cart } = useContext(CartContext);

  const tabs = [
    { id: "air", label: "Air", icon: "flight" },
    { id: "car", label: "Car", icon: "directions_car" },
    { id: "home", label: "Home", icon: "home" },
    { id: "quick", label: "Quick", icon: "flash_on" },
    { id: "cart", label: "Cart", icon: "shopping_cart" },
  ];

  // Show thank you tab only if we have payment details
  const visibleTabs = paymentDetails
    ? [...tabs, { id: "thankyou", label: "Thank You", icon: "done_all" }]
    : tabs;

  return (
    <div className="w-full h-full bg-background-light dark:bg-background-dark">
      <div className="bg-gradient-to-r from-secondary/20 to-primary/20 border-b-2 border-secondary/30 dark:border-gray-700">
        <nav
          aria-label="Tabs"
          className="-mb-px flex"
        >
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${
                activeTab === tab.id
                  ? "border-primary text-primary bg-white/80 dark:bg-gray-800/80"
                  : "border-transparent text-gray-600 hover:text-primary hover:border-primary/50 hover:bg-white/40 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-500"
              } flex-1 py-2 sm:py-3 px-1 sm:px-3 border-b-2 font-semibold text-sm sm:text-base flex items-center justify-center relative transition-all duration-200 rounded-t-lg`}
            >
              <span className="material-icons text-lg sm:text-xl md:mr-1.5">
                {tab.icon}
              </span>
              <span className="hidden md:inline">{tab.label}</span>
              {tab.id === "cart" && cart.length > 0 && (
                <span className="ml-1 bg-accent text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center animate-pulse">
                  {cart.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "car" && <CarCalculator setActiveTab={setActiveTab} />}
      {activeTab === "air" && <AirCalculator setActiveTab={setActiveTab} />}
      {activeTab === "home" && <HomeCalculator setActiveTab={setActiveTab} />}
      {activeTab === "quick" && <QuickOffset setActiveTab={setActiveTab} />}
      {activeTab === "cart" && (
        <Cart
          setActiveTab={setActiveTab}
          onPaymentSuccess={(details) => setPaymentDetails(details)}
        />
      )}
      {activeTab === "thankyou" && (
        <ThankYou paymentDetails={paymentDetails} setActiveTab={setActiveTab} />
      )}
    </div>
  );
};

export default CarbonCalculator;
