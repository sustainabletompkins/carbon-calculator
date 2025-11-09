import { useState } from "react";
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { saveOffsetRecords } from "../utils/firestore";
import "./StripeCheckout.css";

const StripeCheckout = ({
  totalAmount,
  cartItems,
  userEmail,
  onSuccess,
  onCancel,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      setError("Stripe has not loaded");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create payment intent on backend
      const paymentResponse = await fetch(
        `${
          import.meta.env.VITE_API_URL || "http://localhost:3000"
        }/api/payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: Math.round(totalAmount * 100), // Convert to cents
          }),
        }
      );

      const paymentData = await paymentResponse.json();

      if (paymentData.error) {
        setError(paymentData.error);
        setLoading(false);
        return;
      }

      // Step 2: Confirm payment with Stripe using the client secret
      const { error: confirmError, paymentIntent } =
        await stripe.confirmCardPayment(paymentData.clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: {
              name: "Carbon Offset Customer",
            },
          },
        });

      if (confirmError) {
        setError(confirmError.message);
        setLoading(false);
        return;
      }

      // Payment successful
      if (paymentIntent.status === "succeeded") {
        // Save offset records to Firestore
        try {
          if (cartItems && cartItems.length > 0 && userEmail) {
            await saveOffsetRecords(userEmail, paymentIntent.id, cartItems);
            console.log("Offset records saved to Firestore successfully");
          }
        } catch (firestoreError) {
          console.error("Error saving offset records:", firestoreError);
          // Don't fail the payment process if Firestore save fails
          // but log it for debugging
        }

        onSuccess({
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
        });
      } else {
        setError(`Payment status: ${paymentIntent.status}`);
      }
    } catch (err) {
      setError(err.message);
      console.error("Payment error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stripe-checkout-modal">
      <div className="stripe-checkout-content">
        <div className="stripe-checkout-header">
          <h3>Complete Your Payment</h3>
          <button
            onClick={onCancel}
            className="stripe-checkout-close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="stripe-checkout-body">
          <div className="payment-amount">
            <p className="label">Total Amount</p>
            <p className="amount">${totalAmount.toFixed(2)}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="card-element-wrapper">
              <label htmlFor="card-element">Card Details</label>
              <CardElement
                id="card-element"
                options={{
                  style: {
                    base: {
                      fontSize: "16px",
                      color: "#424770",
                      "::placeholder": {
                        color: "#aab7c4",
                      },
                    },
                    invalid: {
                      color: "#fa755a",
                    },
                  },
                }}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="stripe-checkout-actions">
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !stripe}
              >
                {loading ? "Processing..." : `Pay $${totalAmount.toFixed(2)}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StripeCheckout;
