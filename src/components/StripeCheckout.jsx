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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Team contribution state — populated after a successful payment
  const [teamPrompt, setTeamPrompt] = useState(null);
  // { teams, totalPounds, totalDollars, offsetIds, paymentResult }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      setError("Stripe has not loaded");
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
                ? [{ legacyId: individual.legacyId, name: individual.name, isIndividual: true, pounds: individual.pounds }]
                : []),
              ...memberships.map((m) => ({
                legacyId: m.teamId,
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
                accounts[0].legacyId,
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

  const handleTeamContribute = async (teamId) => {
    if (!teamPrompt) return;
    try {
      await attributeOffsetToTeam(
        teamId,
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
