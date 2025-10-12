import { useContext } from "react";
import { CartContext } from "../contexts/CartContext";

const Cart = ({ setActiveTab }) => {
  const { cart, removeFromCart, clearCart } = useContext(CartContext);

  const totalCost = cart.reduce((acc, item) => acc + item.cost, 0);
  const totalCo2 = cart.reduce((acc, item) => acc + item.co2, 0);

  return (
    <main className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-center">
        Your Carbon Offset Cart
      </h2>

      {cart.length === 0 ? (
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
        </div>
      ) : (
        <div>
          <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
            {cart.map((item, index) => (
              <div
                key={index}
                className="bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-icons text-primary text-sm">
                        {item.tripMode === "car"
                          ? "directions_car"
                          : item.tripMode === "air"
                          ? "flight"
                          : "home"}
                      </span>
                      <p className="font-semibold text-text-light dark:text-text-dark">
                        {item.tripMode === "car"
                          ? "Car Trip"
                          : item.tripMode === "air"
                          ? "Air Travel"
                          : "Offset"}
                      </p>
                    </div>
                    {item.origin && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.origin}{" "}
                        {item.destination && `→ ${item.destination}`}
                      </p>
                    )}
                    <div className="flex gap-4 mt-2 text-xs text-muted-light dark:text-muted-dark">
                      <span>{item.distance.toFixed(2)} miles</span>
                      <span>•</span>
                      <span>{item.co2.toFixed(2)} kg CO2</span>
                      {item.travelers && item.travelers > 1 && (
                        <>
                          <span>•</span>
                          <span>{item.travelers} travelers</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-primary text-lg">
                      ${item.cost.toFixed(2)}
                    </p>
                    <button
                      onClick={() => removeFromCart(index)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                    >
                      <span className="material-icons text-sm">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Section */}
          <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-sm text-muted-light dark:text-muted-dark mb-1">
                  Total CO2 to Offset
                </p>
                <p className="text-2xl font-bold text-primary">
                  {totalCo2.toFixed(2)} kg
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-light dark:text-muted-dark mb-1">
                  Total Cost
                </p>
                <p className="text-3xl font-bold text-primary">
                  ${totalCost.toFixed(2)}
                </p>
              </div>
            </div>
            <p className="text-xs text-center text-muted-light dark:text-muted-dark">
              Your contribution helps fund sustainable projects and reduce
              global emissions
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="flex-1 inline-flex justify-center items-center bg-gradient-to-r from-primary to-secondary text-white py-3 px-6 rounded-lg font-semibold hover:from-primary/90 hover:to-secondary/90 transition-all duration-200 shadow-md">
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
      <div className="mt-6 sm:mt-8 border-t border-gray-200 dark:border-gray-700 pt-4 sm:pt-6">
        <div className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-lg p-4 sm:p-6 border border-green-200 dark:border-green-800">
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="material-icons text-primary text-2xl sm:text-3xl">
              info
            </span>
            <div className="flex-1">
              <h3 className="font-semibold text-sm sm:text-base text-text-light dark:text-text-dark mb-2">
                Want to offset more of your carbon footprint?
              </h3>
              <p className="text-sm text-muted-light dark:text-muted-dark mb-4">
                Add offsets for all your trips and activities to maximize your
                positive impact on the environment.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab("car")}
                  className="inline-flex items-center gap-1 bg-white dark:bg-gray-800 px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 transition-colors"
                >
                  <span className="material-icons text-sm">directions_car</span>
                  Add Car Trip
                </button>
                <button
                  onClick={() => setActiveTab("air")}
                  className="inline-flex items-center gap-1 bg-white dark:bg-gray-800 px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 transition-colors"
                >
                  <span className="material-icons text-sm">flight</span>
                  Add Flight
                </button>
                <button
                  onClick={() => setActiveTab("home")}
                  className="inline-flex items-center gap-1 bg-white dark:bg-gray-800 px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 transition-colors"
                >
                  <span className="material-icons text-sm">home</span>
                  Add Home Energy
                </button>
                <button
                  onClick={() => setActiveTab("quick")}
                  className="inline-flex items-center gap-1 bg-white dark:bg-gray-800 px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 transition-colors"
                >
                  <span className="material-icons text-sm">flash_on</span>
                  Quick Offset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Cart;
