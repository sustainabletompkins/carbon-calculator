import { useContext, useState, useEffect } from "react";
import { CartContext } from "../contexts/CartContext";
import StripeCheckout from "./StripeCheckout";
import { PageHeader } from "./ui";
import { LBS_PER_KG, kgToLbs, poundsForDollars } from "../../lib/offsetRates.js";

const ITEM_LABELS = {
  car: "Car Trip",
  air: "Air Travel",
  home: "Home Energy",
  quick: "Quick Offset",
};

const CALCULATOR_LINKS = [
  { tab: "car", icon: "directions_car", label: "Add Car Trip" },
  { tab: "air", icon: "flight", label: "Add Flight" },
  { tab: "home", icon: "home", label: "Add Home Energy" },
  { tab: "quick", icon: "flash_on", label: "Quick Offset" },
];

const ITEM_ICONS = {
  car: "directions_car",
  air: "flight",
  home: "home",
  quick: "flash_on",
};

// Reduce a cart item to the one line a receipt row can show.
const describeItem = (item) => {
  if (item.type === "donation") {
    return {
      icon: "favorite",
      title: "Direct Donation",
      detail: "Supports environmental initiatives",
      meta: [],
    };
  }

  const title = ITEM_LABELS[item.tripMode] || "Offset";
  // Calculators that aren't trips repeat their name in `origin`, so only the
  // origin → destination pairs are worth showing as a route.
  const detail =
    item.destination && item.origin !== title
      ? `${item.origin} → ${item.destination}`
      : item.destination || item.origin || "";

  const meta = [];
  if (item.distance > 0) {
    meta.push(
      `${item.distance.toLocaleString(undefined, {
        maximumFractionDigits: 1,
      })} mi`,
    );
  }
  if (item.co2 > 0) meta.push(`${Math.round(kgToLbs(item.co2)).toLocaleString()} lbs CO2`);
  if (item.travelers > 1) meta.push(`${item.travelers} travelers`);

  return { icon: ITEM_ICONS[item.tripMode] || "eco", title, detail, meta };
};

const Cart = ({ setActiveTab, onPaymentSuccess }) => {
  const {
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    userEmail,
    setUserEmail,
  } = useContext(CartContext);
  const [showCheckout, setShowCheckout] = useState(false);
  const [localUserEmail, setLocalUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userZipCode, setUserZipCode] = useState("");
  const [emailError, setEmailError] = useState("");
  const [donationAmount, setDonationAmount] = useState("");
  const [donationError, setDonationError] = useState("");

  // Initialize local email from context
  useEffect(() => {
    if (userEmail) {
      setLocalUserEmail(userEmail);
    }
  }, [userEmail]);

  const totalCost = cart.reduce((acc, item) => acc + item.cost, 0);
  const totalCo2 = cart.reduce((acc, item) => acc + item.co2, 0);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddDonation = () => {
    const amount = parseFloat(donationAmount);

    if (!donationAmount || donationAmount.trim() === "") {
      setDonationError("Please enter a donation amount");
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      setDonationError("Please enter a valid amount greater than $0");
      return;
    }

    if (amount > 10000) {
      setDonationError("Maximum donation amount is $10,000");
      return;
    }

    const donationItem = {
      type: "donation",
      cost: amount,
      co2: poundsForDollars(amount) / LBS_PER_KG,
      description: `Direct Donation`,
    };

    addToCart(donationItem);
    setDonationAmount("");
    setDonationError("");
  };

  const handleCheckoutClick = () => {
    if (!localUserEmail) {
      setEmailError("Please enter your email address");
      return;
    }
    if (!validateEmail(localUserEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError("");
    // Set user email in context for Firestore operations
    setUserEmail(localUserEmail);
    setShowCheckout(true);
  };

  // Store user info for webhook integration
  const userInfo = {
    email: localUserEmail,
    name: userName,
    zipCode: userZipCode,
  };

  const calculatorLinks = (
    <div className="flex flex-wrap gap-2">
      {CALCULATOR_LINKS.map(({ tab, icon, label }) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className="inline-flex items-center gap-1 bg-white dark:bg-gray-800 px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 transition-colors"
        >
          <span className="material-icons text-sm">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <main className="p-3 sm:p-4 max-w-6xl mx-auto">
      {cart.length > 0 && (
        <PageHeader
          title="Your Carbon Offset Cart"
          subtitle="Review your offsets and complete your contribution"
        />
      )}

      {cart.length === 0 ? (
        <div>
          <div className="text-center py-8 sm:py-12">
            <span
              className="material-icons text-gray-300 dark:text-gray-600 mb-4"
              style={{ fontSize: "48px" }}
            >
              shopping_cart
            </span>
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              Your cart is empty.
            </p>
            <p className="text-xs sm:text-sm text-muted-light dark:text-muted-dark mb-6">
              Calculate your carbon footprint and add offsets to get started!
            </p>
            <div className="flex justify-center">{calculatorLinks}</div>
          </div>

          {/* Donation Section - Visible in Empty Cart */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-icons text-blue-600 dark:text-blue-400">
                favorite
              </span>
              <h3 className="font-semibold text-text-light dark:text-text-dark">
                Make a Direct Donation
              </h3>
            </div>
            <p className="text-left text-sm text-gray-600 dark:text-gray-400 mb-4">
              Want to contribute directly to environmental initiatives without
              calculating a specific carbon offset? Add a donation to your
              order.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  value={donationAmount}
                  onChange={(e) => {
                    setDonationAmount(e.target.value);
                    setDonationError("");
                  }}
                  placeholder="Enter donation amount (USD)"
                  min="0.01"
                  max="10000"
                  step="0.01"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-text-light dark:text-text-dark placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {donationError && (
                  <p className="text-red-500 text-sm mt-2">{donationError}</p>
                )}
              </div>
              <button
                onClick={handleAddDonation}
                className="inline-flex justify-center items-center bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white py-3 px-6 rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                <span className="material-icons mr-2">add_circle</span>
                Add Donation
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* Line Items + Total */}
          <div className="mb-3 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {cart.map((item, index) => {
                const { icon, title, detail, meta } = describeItem(item);
                return (
                  <li
                    key={index}
                    className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5"
                  >
                    <span
                      className="material-icons shrink-0 text-primary"
                      style={{ fontSize: "20px" }}
                    >
                      {icon}
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      {/* Detail sits beside the title on wide rows, under it
                          on narrow ones so long routes stay readable. */}
                      <p className="text-sm font-semibold text-text-light dark:text-text-dark sm:truncate">
                        {title}
                        {detail && (
                          <span className="block text-xs font-normal text-muted-light dark:text-muted-dark sm:ml-2 sm:inline sm:text-sm">
                            {detail}
                          </span>
                        )}
                      </p>
                      {meta.length > 0 && (
                        <p className="text-xs text-muted-light dark:text-muted-dark">
                          {meta.join(" · ")}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums text-primary">
                      ${item.cost.toFixed(2)}
                    </p>
                    <button
                      onClick={() => removeFromCart(index)}
                      aria-label={`Remove ${title}`}
                      className="shrink-0 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                    >
                      <span
                        className="material-icons"
                        style={{ fontSize: "18px" }}
                      >
                        delete
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between gap-3 border-t border-gray-200 dark:border-gray-700 bg-primary/10 dark:bg-primary/20 px-3 sm:px-4 py-3">
              <div className="text-left">
                <p className="text-sm font-semibold text-text-light dark:text-text-dark">
                  Total
                </p>
                <p className="text-xs text-muted-light dark:text-muted-dark">
                  {Math.round(kgToLbs(totalCo2)).toLocaleString()} lbs CO2 to offset
                </p>
              </div>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-primary">
                ${totalCost.toFixed(2)}
              </p>
            </div>
          </div>

          <p className="mb-4 sm:mb-6 text-center text-xs text-muted-light dark:text-muted-dark">
            Your contribution helps fund sustainable projects and reduce global
            emissions
          </p>

          {/* User Information Section */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-text-light dark:text-text-dark mb-4">
              Contact Information
            </h3>

            {/* Email Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={localUserEmail}
                onChange={(e) => {
                  setLocalUserEmail(e.target.value);
                  setEmailError("");
                }}
                placeholder="your.email@example.com"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-text-light dark:text-text-dark placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {emailError && (
                <p className="text-red-500 text-sm mt-2">{emailError}</p>
              )}
              <p className="text-xs text-muted-light dark:text-muted-dark mt-2">
                We'll use this to track your carbon offset records and link your
                purchases.
              </p>
            </div>

            {/* Name Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-text-light dark:text-text-dark placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-muted-light dark:text-muted-dark mt-2">
                Used for donation receipts and recognition (optional)
              </p>
            </div>

            {/* Zip Code Input */}
            <div>
              <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                Zip Code
              </label>
              <input
                type="text"
                value={userZipCode}
                onChange={(e) => setUserZipCode(e.target.value)}
                placeholder="14850"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-text-light dark:text-text-dark placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-muted-light dark:text-muted-dark mt-2">
                Used for location-based tracking (optional)
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleCheckoutClick}
              className="flex-1 inline-flex justify-center items-center bg-gradient-to-r from-primary to-secondary text-white py-3 px-6 rounded-lg font-semibold hover:from-primary/90 hover:to-secondary/90 transition-all duration-200 shadow-md"
            >
              <span className="material-icons mr-2">
                shopping_cart_checkout
              </span>
              Proceed to Checkout
            </button>
            <button
              onClick={clearCart}
              className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 px-6 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Clear Cart
            </button>
          </div>
        </div>
      )}

      {/* Call to Action for Adding More */}
      {cart.length > 0 && (
        <div className="mt-6 sm:mt-8 border-t border-gray-200 dark:border-gray-700 pt-4 sm:pt-6">
          <div className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-lg p-4 sm:p-6 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3 sm:gap-4">
              <span className="material-icons text-primary text-2xl sm:text-3xl">
                info
              </span>
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-text-light dark:text-text-dark mb-2">
                  Want to offset more of your carbon footprint?
                </h3>
                <p className="text-sm text-muted-light dark:text-muted-dark mb-4">
                  Add offsets for all your trips and activities to maximize your
                  positive impact on the environment.
                </p>
                {calculatorLinks}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Checkout Modal */}
      {showCheckout && (
        <StripeCheckout
          totalAmount={totalCost}
          cartItems={cart}
          userEmail={localUserEmail}
          userName={userName}
          userZipCode={userZipCode}
          onSuccess={(result) => {
            setShowCheckout(false);
            clearCart();
            if (onPaymentSuccess) {
              onPaymentSuccess(result);
            }
            setActiveTab("thankyou");
          }}
          onCancel={() => setShowCheckout(false)}
        />
      )}
    </main>
  );
};

export default Cart;
