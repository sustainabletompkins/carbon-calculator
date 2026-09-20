import { useState } from "react";
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import {
  saveOffsetRecords,
  getOrCreateUserByEmail,
  markCartItemsAsPurchased,
  updateUserProfile,
  getTeamMembershipsByEmail,
  getIndividualAccountByEmail,
  attributeOffsetToTeam,
} from "../utils/firestore";
import TeamContributionModal from "./TeamContributionModal";
import "./StripeCheckout.css";
import { API_URL } from "../utils/apiUrl";
import { useStripeStatus } from "../utils/stripeLoader.js";

const StripeCheckout = ({
  totalAmount,
  cartItems,
  userEmail,
  userName,
  userZipCode,
  onSuccess,
  onCancel,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const stripeStatus = useStripeStatus();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Team contribution state — populated after a successful payment
  const [teamPrompt, setTeamPrompt] = useState(null);
  // { teams, totalPounds, totalDollars, offsetIds, paymentResult }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      setError("The payment form is still loading. Please try again in a moment.");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Ensure user exists or create one with additional profile data
      if (userEmail) {
        const userData = {};
        if (userName) userData.name = userName;
        if (userZipCode) userData.zipCode = userZipCode;
        
        await getOrCreateUserByEmail(userEmail, userData);
        
        // Step 1b: Update user profile if they already exist
        if (userName || userZipCode) {
          try {
            await updateUserProfile(userEmail, userData);
          } catch (updateError) {
            console.warn("Could not update user profile:", updateError);
            // Don't fail the payment if profile update fails
          }
        }
      }

      // Step 2: Create payment intent on backend
      const paymentResponse = await fetch(
        `${API_URL}/api/payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: Math.round(totalAmount * 100), // Convert to cents
            userEmail,
          }),
        }
      );

      const paymentData = await paymentResponse.json();

      if (paymentData.error) {
        setError(paymentData.error);
        setLoading(false);
        return;
      }

      // Step 3: Confirm payment with Stripe using the client secret
      const { error: confirmError, paymentIntent } =
        await stripe.confirmCardPayment(paymentData.clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: {
              email: userEmail,
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
        const paymentResult = {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          userEmail,
        };

        // Step 4: Save offset records to Firestore linked to user email
        let savedOffsetIds = [];
        try {
          if (cartItems && cartItems.length > 0 && userEmail) {
            savedOffsetIds = await saveOffsetRecords(
              userEmail,
              paymentIntent.id,
              cartItems
            );
            console.log(
              `Offset records saved to Firestore successfully: ${savedOffsetIds.join(", ")}`
            );

            // Step 5: Mark cart items as purchased
            const cartItemIds = cartItems
              .filter((item) => item.id)
              .map((item) => item.id);

            if (cartItemIds.length > 0) {
              await markCartItemsAsPurchased(cartItemIds);
              console.log(`Marked ${cartItemIds.length} cart items as purchased`);
            }
          }
        } catch (firestoreError) {
          console.error("Error saving offset records:", firestoreError);
        }

        // Step 6: Resolve account(s) for attribution
        if (userEmail) {
          try {
            const [individual, memberships] = await Promise.all([
              getIndividualAccountByEmail(userEmail),
              getTeamMembershipsByEmail(userEmail),
            ]);

            // Build a normalised list of accounts the user can attribute to
            const accounts = [
              ...(individual
                ? [{ docId: individual.id, name: individual.name, isIndividual: true, pounds: individual.pounds }]
                : []),
              ...memberships.map((m) => ({
                docId: m.teamDocId,
                name: m.teamName,
                isIndividual: false,
                pounds: null,
              })),
            ];

            if (accounts.length === 1) {
              // Auto-attribute — no prompt needed
              const totalPounds = cartItems.reduce(
                (sum, item) => sum + (item.co2 ? item.co2 * 2.20462 : 0),
                0
              );
              await attributeOffsetToTeam(
                accounts[0].docId,
                totalPounds,
                totalAmount,
                savedOffsetIds
              );
            } else if (accounts.length > 1) {
              // Multiple options — let the user choose
              const totalPounds = cartItems.reduce(
                (sum, item) => sum + (item.co2 ? item.co2 * 2.20462 : 0),
                0
              );
              setTeamPrompt({
                accounts,
                totalPounds,
                totalDollars: totalAmount,
                offsetIds: savedOffsetIds,
                paymentResult,
              });
              return; // Hold until selection
            }
          } catch (accountError) {
            console.warn("Could not resolve account for attribution:", accountError);
          }
        }

        onSuccess(paymentResult);
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

  const handleTeamContribute = async (teamDocId) => {
    if (!teamPrompt) return;
    try {
      await attributeOffsetToTeam(
        teamDocId,
        teamPrompt.totalPounds,
        teamPrompt.totalDollars,
        teamPrompt.offsetIds
      );
    } catch (err) {
      console.error("Error attributing offset to team:", err);
      // Don't block the success flow
    }
    setTeamPrompt(null);
    onSuccess(teamPrompt.paymentResult);
  };

  const handleTeamSkip = () => {
    if (!teamPrompt) return;
    const result = teamPrompt.paymentResult;
    setTeamPrompt(null);
    onSuccess(result);
  };

  if (teamPrompt) {
    return (
      <TeamContributionModal
        accounts={teamPrompt.accounts}
        totalPounds={teamPrompt.totalPounds}
        totalDollars={teamPrompt.totalDollars}
        onContribute={handleTeamContribute}
        onSkip={handleTeamSkip}
      />
    );
  }

  // Stripe.js is fetched from js.stripe.com, so it can fail on a flaky network
  // even when everything here is configured correctly.
  const stripeUnavailable =
    stripeStatus === "failed" || stripeStatus === "missing-key";
  const unavailableMessage =
    stripeStatus === "missing-key"
      ? "Card payments aren't configured for this site yet. Please get in touch so we can take your donation another way."
      : "We couldn't load Stripe's secure payment form. This is usually a network, VPN, or ad-blocker issue rather than a problem with your card. Check your connection and reload the page.";

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

          {stripeUnavailable ? (
            <div className="stripe-unavailable">
              <div className="error-message">{unavailableMessage}</div>
              <div className="stripe-checkout-actions">
                <button
                  type="button"
                  onClick={onCancel}
                  className="btn btn-secondary"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="btn btn-primary"
                >
                  Reload page
                </button>
              </div>
            </div>
          ) : (
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
                {loading
                  ? "Processing..."
                  : !stripe
                    ? "Loading payment form..."
                    : `Pay $${totalAmount.toFixed(2)}`}
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default StripeCheckout;
