import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.VITE_STRIPE_SECRET_KEY);

// Middleware
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "Server is running" });
});

// Payment endpoint
app.post("/api/payment", async (req, res) => {
  try {
    const { amount } = req.body;

    // Validate input
    if (!amount) {
      return res.status(400).json({
        error: "Missing required field: amount",
      });
    }

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Amount should be in cents
      currency: "usd",
    });

    // Return the client secret for the frontend to handle
    return res.json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
    });
  } catch (error) {
    console.error("Payment error:", error);
    return res.status(500).json({
      error: error.message || "An error occurred processing the payment",
    });
  }
});

// Create payment intent endpoint (alternative approach)
app.post("/api/create-payment-intent", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Missing amount" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Amount in cents
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      return_url: `${
        process.env.VITE_API_URL || "http://localhost:5173"
      }/checkout-success`,
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return res.status(500).json({
      error: error.message || "An error occurred creating the payment intent",
    });
  }
});

// Webhook endpoint for Stripe events
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        endpointSecret
      );

      // Handle different event types
      switch (event.type) {
        case "payment_intent.succeeded":
          console.log("Payment succeeded:", event.data.object.id);
          // Update your database with the successful payment
          break;

        case "payment_intent.payment_failed":
          console.log("Payment failed:", event.data.object.id);
          // Handle failed payment
          break;

        case "charge.refunded":
          console.log("Charge refunded:", event.data.object.id);
          // Handle refunds
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "An unexpected error occurred",
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(
    `💳 Stripe Secret Key configured: ${
      process.env.VITE_STRIPE_SECRET_KEY ? "✓" : "✗"
    }`
  );
});
