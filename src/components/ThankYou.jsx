import { Confetti } from "./ui/Confetti";

const ThankYou = ({ paymentDetails, setActiveTab }) => {
  return (
    <main className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      <Confetti count={32} />

      <div className="text-center">
        {/* Success icon — bounces in instead of pulsing */}
        <div className="mb-6 sm:mb-8 flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-primary-tint rounded-full flex items-center justify-center animate-bounce-in">
              <span className="material-icons text-primary" style={{ fontSize: '56px' }}>
                check_circle
              </span>
            </div>
            {/* Radiating rings */}
            <div
              className="absolute inset-0 rounded-full border-4 border-primary opacity-0"
              style={{ animation: 'ring-out 1s ease-out 0.3s forwards' }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 rounded-full border-2 border-secondary opacity-0"
              style={{ animation: 'ring-out 1s ease-out 0.6s forwards' }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl font-bold text-text mb-2 sm:mb-4 animate-fade-in">
          Thank You for Your Contribution!
        </h1>
        <p
          className="text-lg sm:text-xl text-muted mb-6 sm:mb-8 animate-fade-in"
          style={{ animationDelay: '0.15s', animationFillMode: 'both' }}
        >
          Your payment has been successfully processed.
        </p>

        {/* Payment Details */}
        {paymentDetails && (
          <div
            className="bg-gradient-to-br from-primary-tint to-secondary-tint rounded-lg p-6 sm:p-8 mb-6 sm:mb-8 border border-primary/30 text-left animate-fade-in"
            style={{ animationDelay: '0.25s', animationFillMode: 'both' }}
          >
            <h2 className="text-lg sm:text-xl font-semibold text-text mb-4">
              Payment Confirmation
            </h2>

            <div className="space-y-3 sm:space-y-4">
              {paymentDetails.id && (
                <div className="flex justify-between items-center pb-3 sm:pb-4 border-b border-primary/20">
                  <span className="text-muted font-medium">Transaction ID:</span>
                  <span className="font-mono text-sm sm:text-base text-text">
                    {paymentDetails.id}
                  </span>
                </div>
              )}

              {paymentDetails.amount && (
                <div className="flex justify-between items-center pb-3 sm:pb-4 border-b border-primary/20">
                  <span className="text-muted font-medium">Amount Paid:</span>
                  <span className="text-lg sm:text-xl font-bold text-primary">
                    ${(paymentDetails.amount / 100).toFixed(2)}
                  </span>
                </div>
              )}

              {paymentDetails.status && (
                <div className="flex justify-between items-center">
                  <span className="text-muted font-medium">Status:</span>
                  <span className="inline-flex items-center gap-1 bg-success-bg text-success px-3 sm:px-4 py-1 sm:py-2 rounded-full text-sm sm:text-base font-semibold">
                    <span className="material-icons text-sm">check</span>
                    {paymentDetails.status === "succeeded" ? "Completed" : "Processing"}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Impact Message */}
        <div
          className="bg-secondary-tint rounded-lg p-6 sm:p-8 mb-6 sm:mb-8 border border-secondary/30 animate-fade-in"
          style={{ animationDelay: '0.35s', animationFillMode: 'both' }}
        >
          <h3 className="text-lg sm:text-xl font-semibold text-text mb-3">
            Your Impact Matters
          </h3>
          <p className="text-sm sm:text-base text-muted mb-4">
            Your contribution is helping fund verified carbon offset projects
            around the world. From renewable energy initiatives to reforestation
            programs, your payment is making a real difference in the fight
            against climate change.
          </p>
          <p className="text-sm sm:text-base text-muted">
            A confirmation email with your receipt and impact details has been
            sent to your email address.
          </p>
        </div>

        {/* Action Buttons */}
        <div
          className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in"
          style={{ animationDelay: '0.45s', animationFillMode: 'both' }}
        >
          <button
            onClick={() => setActiveTab("car")}
            className="flex-1 sm:flex-none inline-flex justify-center items-center bg-gradient-to-r from-primary to-secondary text-white py-3 px-6 rounded-lg font-semibold hover:from-primary-hover hover:to-secondary-hover transition-all duration-200 shadow-md"
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

        {/* Contact */}
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs sm:text-sm text-muted mb-4">
            Questions about your contribution?
          </p>
          <p className="text-xs sm:text-sm text-muted">
            Contact us at{" "}
            <a
              href="mailto:sustainablefingerlakes@gmail.com"
              className="text-primary hover:text-primary-hover font-semibold underline"
            >
              sustainablefingerlakes@gmail.com
            </a>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes ring-out {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </main>
  );
};

export default ThankYou;
