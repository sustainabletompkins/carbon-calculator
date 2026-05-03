const ThankYou = ({ paymentDetails, setActiveTab }) => {
  return (
    <main className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      <div className="text-center">
        {/* Success Icon */}
        <div className="mb-6 sm:mb-8 flex justify-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center animate-pulse">
            <span className="material-icons text-green-600 dark:text-green-400 text-5xl sm:text-6xl">
              check_circle
            </span>
          </div>
        </div>

        {/* Main Message */}
        <h1 className="text-3xl sm:text-4xl font-bold text-text-light dark:text-text-dark mb-2 sm:mb-4">
          Thank You for Your Contribution!
        </h1>
        <p className="text-lg sm:text-xl text-muted-light dark:text-muted-dark mb-6 sm:mb-8">
          Your payment has been successfully processed.
        </p>

        {/* Payment Details */}
        {paymentDetails && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 sm:p-8 mb-6 sm:mb-8 border border-green-200 dark:border-green-800 text-left">
            <h2 className="text-lg sm:text-xl font-semibold text-text-light dark:text-text-dark mb-4">
              Payment Confirmation
            </h2>

            <div className="space-y-3 sm:space-y-4">
              {paymentDetails.id && (
                <div className="flex justify-between items-center pb-3 sm:pb-4 border-b border-green-300 dark:border-green-700">
                  <span className="text-muted-light dark:text-muted-dark font-medium">
                    Transaction ID:
                  </span>
                  <span className="font-mono text-sm sm:text-base text-text-light dark:text-text-dark">
                    {paymentDetails.id}
                  </span>
                </div>
              )}

              {paymentDetails.amount && (
                <div className="flex justify-between items-center pb-3 sm:pb-4 border-b border-green-300 dark:border-green-700">
                  <span className="text-muted-light dark:text-muted-dark font-medium">
                    Amount Paid:
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-primary">
                    ${(paymentDetails.amount / 100).toFixed(2)}
                  </span>
                </div>
              )}

              {paymentDetails.status && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-light dark:text-muted-dark font-medium">
                    Status:
                  </span>
                  <span className="inline-flex items-center gap-1 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-3 sm:px-4 py-1 sm:py-2 rounded-full text-sm sm:text-base font-semibold">
                    <span className="material-icons text-sm">check</span>
                    {paymentDetails.status === "succeeded"
                      ? "Completed"
                      : "Processing"}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Impact Message */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 sm:p-8 mb-6 sm:mb-8 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg sm:text-xl font-semibold text-text-light dark:text-text-dark mb-3">
            Your Impact Matters
          </h3>
          <p className="text-sm sm:text-base text-muted-light dark:text-muted-dark mb-4">
            Your contribution is helping fund verified carbon offset projects
            around the world. From renewable energy initiatives to reforestation
            programs, your payment is making a real difference in the fight
            against climate change.
          </p>
          <p className="text-sm sm:text-base text-muted-light dark:text-muted-dark">
            A confirmation email with your receipt and impact details has been
            sent to your email address.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => setActiveTab("car")}
            className="flex-1 sm:flex-none inline-flex justify-center items-center bg-gradient-to-r from-primary to-secondary text-white py-3 px-6 rounded-lg font-semibold hover:from-primary/90 hover:to-secondary/90 transition-all duration-200 shadow-md"
          >
            <span className="material-icons mr-2">add</span>
            Calculate More Offsets
          </button>
          <button
            onClick={() => setActiveTab("cart")}
            className="flex-1 sm:flex-none inline-flex justify-center items-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 px-6 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <span className="material-icons mr-2">shopping_cart</span>
            Back to Cart
          </button>
        </div>

        {/* Additional Info */}
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs sm:text-sm text-muted-light dark:text-muted-dark mb-4">
            Questions about your contribution?
          </p>
          <p className="text-xs sm:text-sm text-muted-light dark:text-muted-dark">
            Contact us at{" "}
            <a
              href="mailto:sustainablefingerlakes@gmail.com"
              className="text-primary hover:text-primary/80 font-semibold underline"
            >
              sustainablefingerlakes@gmail.com
            </a>
          </p>
        </div>
      </div>
    </main>
  );
};

export default ThankYou;
