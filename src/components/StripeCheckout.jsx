import { useState } from "react";
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import {
  saveOffsetRecords,
  getOrCreateUserByEmail,
  markCartItemsAsPurchased,
  updateUserProfile,
  getTeamMembershipsByEmail,
  getIndividualAccountByEmail,
  getTeamDocIdByLegacyId,
  attributeOffsetToTeam,
} from "../utils/firestore";
import TeamContributionModal from "./TeamContributionModal";
import "./StripeCheckout.css";
import { API_URL } from "../utils/apiUrl";
import { kgToLbs } from "../../lib/offsetRates.js";
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
  // { accounts, totalPounds, totalDollars, paymentIntentId, paymentResult }

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

            // Memberships added through the admin UI have no teamDocId, so
            // resolve those from the team's legacyId. Without a doc ID there
            // is nothing to attribute to, so those accounts are dropped
            // rather than offered as a choice that can't be honoured.
            const teamAccounts = (
              await Promise.all(
                memberships.map(async (m) => ({
                  docId: m.teamDocId || (await getTeamDocIdByLegacyId(m.teamId)),
                  name: m.teamName,
                  isIndividual: false,
                  pounds: null,
                }))
              )
            ).filter((account) => {
              if (account.docId) return true;
              console.warn(
                `Skipping team "${account.name}" for attribution: no team document found`
              );
              return false;
            });

            // Build a normalised list of accounts the user can attribute to
            const accounts = [
              ...(individual
                ? [{ docId: individual.id, name: individual.name, isIndividual: true, pounds: individual.pounds }]
                : []),
              ...teamAccounts,
            ];

            // Always prompt, whatever the account count. The prompt is also
            // where someone joins or starts a team, and skipping it when
            // there were no accounts is what left first-time buyers with
            // nowhere to put the credit. A lone account arrives preselected,
            // so confirming it is one click.
            const totalPounds = cartItems.reduce(
              (sum, item) => sum + (item.co2 ? kgToLbs(item.co2) : 0),
              0
            );
            setTeamPrompt({
              accounts,
              totalPounds,
              totalDollars: totalAmount,
              paymentIntentId: paymentIntent.id,
              paymentResult,
            });
            return; // Hold until the visitor chooses
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

  // Credits the purchase and lets failures through: the modal keeps itself
  // open and explains, rather than closing on a celebration that didn't
  // happen. Closing the modal is what finishes checkout.
  const handleTeamContribute = (teamDocId) =>
    attributeOffsetToTeam(teamDocId, teamPrompt.paymentIntentId);

  const handleTeamClose = () => {
    if (!teamPrompt) return;
    const result = teamPrompt.paymentResult;
    setTeamPrompt(null);
    onSuccess(result);
  };

  if (teamPrompt) {
    return (
      <TeamContributionModal
        accounts={teamPrompt.accounts}
        email={userEmail}
        totalPounds={teamPrompt.totalPounds}
        totalDollars={teamPrompt.totalDollars}
        onContribute={handleTeamContribute}
        onClose={handleTeamClose}
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
