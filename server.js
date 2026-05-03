import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import admin from "firebase-admin";

dotenv.config();

// ─── Firebase Admin init ─────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.join(__dirname, "scripts/serviceAccountKey.json");

if (!admin.apps.length) {
  if (fs.existsSync(serviceAccountPath)) {
    const require = createRequire(import.meta.url);
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // Fall back to application default credentials (Cloud Run, etc.)
    admin.initializeApp();
  }
}

const db = admin.firestore();

// ─── Region ID → name (loaded from regions.json) ─────────────────────────────
const regionsPath = path.join(__dirname, "regions.json");
const REGION_NAMES = fs.existsSync(regionsPath)
  ? fs
      .readFileSync(regionsPath, "utf-8")
      .split("\n")
      .reduce((map, line) => {
        const trimmed = line.trim();
        if (!trimmed) return map;
        try {
          const r = JSON.parse(trimmed);
          if (r.id != null && r.name) map[r.id] = r.name;
        } catch { /* skip malformed */ }
        return map;
      }, {})
  : {};

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

// Regions endpoint — reads from Firestore `regions` collection
app.get("/api/regions", async (_req, res) => {
  try {
    const snapshot = await db.collection("regions").orderBy("name", "asc").get();
    const regions = snapshot.docs.map((doc) => {
      const d = doc.data();
      return { id: d.legacyId, name: d.name };
    });
    return res.json(regions);
  } catch (err) {
    console.error("Error fetching regions:", err);
    return res.status(500).json({ error: "Failed to fetch regions" });
  }
});

// Teams endpoint — reads from Firestore
// ?order=pounds (default) | count
// ?type=team (default) | individual  — filters by isIndividual flag
app.get("/api/teams", async (req, res) => {
  const orderBy = req.query.order === "count" ? "count" : "pounds";
  const typeFilter = req.query.type === "individual" ? "individual" : "team";

  try {
    const snapshot = await db
      .collection("teams")
      .orderBy(orderBy, "desc")
      .get();

    const teams = snapshot.docs
      .map((doc) => {
        const d = doc.data();
        return {
          team: d.name,
          pounds: d.pounds ?? 0,
          count: d.count ?? 0,
          region: REGION_NAMES[d.regionId] ?? null,
          image: d.image ?? "",
          isIndividual: d.isIndividual ?? false,
        };
      })
      .filter((t) =>
        typeFilter === "individual" ? t.isIndividual : !t.isIndividual
      );

    return res.json(teams);
  } catch (err) {
    console.error("Error fetching teams:", err);
    return res.status(500).json({ error: "Failed to fetch teams" });
  }
});

// Team funding data endpoint (legacy hardcoded data — kept for backwards compatibility)
app.get("/api/team-funding", (req, res) => {
  const teamFundingData = [
    { team: "The Rainy Day Fund", pounds: 800000.0, count: 1, region: null },
    { team: "Solar Tompkins", pounds: 800000.0, count: 1, region: null },
    { team: "Halco", pounds: 400000.0, count: 1, region: null },
    { team: "Park Foundation, Inc", pounds: 218256.5, count: 4, region: null },
    { team: "Dailey Electric, Inc.", pounds: 180000.0, count: 2, region: null },
    { team: "Colgate University", pounds: 160000.0, count: 1, region: null },
    { team: "Alicia Wittink", pounds: 131040.0, count: 1, region: null },
    { team: "Snug Planet", pounds: 120000.0, count: 2, region: null },
    { team: "Leslie Danks Burke", pounds: 92400.0, count: 12, region: null },
    { team: "Beck Equipment", pounds: 80080.0, count: 1, region: null },
    {
      team: "William and Carol Klepack",
      pounds: 80000.0,
      count: 2,
      region: null,
    },
    { team: "Natural Investments", pounds: 80000.0, count: 2, region: null },
    { team: "Stuart Staniford", pounds: 68288.48, count: 8, region: null },
    { team: "Joe Wilson", pounds: 64000.0, count: 2, region: null },
    { team: "John Keevert", pounds: 57596.0, count: 5, region: null },
    {
      team: "Atkinson Center for a Sustainable Future",
      pounds: 51040.0,
      count: 1,
      region: null,
    },
    { team: "Susan Robinson", pounds: 47861.17, count: 29, region: null },
    {
      team: "Phillips Kleinberg Family Fund",
      pounds: 44000.0,
      count: 1,
      region: null,
    },
    { team: "Dave Ritchie", pounds: 43900.98, count: 8, region: null },
    { team: "Social Ventures, Inc.", pounds: 40000.0, count: 2, region: null },
    { team: "Simply Installs, LLC", pounds: 40000.0, count: 2, region: null },
    { team: "Trautmann Family Fund", pounds: 40000.0, count: 1, region: null },
    {
      team: "Carol Bushberg Real Estate",
      pounds: 40000.0,
      count: 1,
      region: null,
    },
    { team: "Vanessa Fajans-Turner", pounds: 40000.0, count: 1, region: null },
    { team: "WillieWillie Max", pounds: 37711.94, count: 3, region: null },
    { team: "Juliette Corazón", pounds: 28560.0, count: 1, region: null },
    { team: "Liz", pounds: 26905.79, count: 5, region: null },
    { team: "kathy russell", pounds: 25240.0, count: 3, region: null },
    { team: "Nancy Jacobson", pounds: 24000.0, count: 1, region: null },
    { team: "Caroline Hyneman", pounds: 23600.0, count: 15, region: null },
    {
      team: "Robert L. Cooper and Lucy Keeler",
      pounds: 23460.739999999998,
      count: 3,
      region: null,
    },
    { team: "Firelight Camps", pounds: 20000.0, count: 1, region: null },
    { team: "Lynn Leopold", pounds: 20000.0, count: 1, region: null },
    { team: "Megan Szerwo", pounds: 20000.0, count: 1, region: null },
    { team: "Polly Marion", pounds: 20000.0, count: 1, region: null },
    { team: "Judy Jones", pounds: 16000.0, count: 1, region: null },
    {
      team: "Joseph B. Yavitt and Susan M. Merkel",
      pounds: 16000.0,
      count: 1,
      region: null,
    },
    { team: "Jennifer Wilkins", pounds: 13936.32, count: 4, region: null },
    {
      team: "CCE-TC Environment Team",
      pounds: 12984.61,
      count: 4,
      region: null,
    },
    { team: "Maggie Mowrer", pounds: 12485.03, count: 10, region: null },
    { team: "Gerri Wiley", pounds: 12000.0, count: 1, region: null },
    { team: "Jordan Yanowitz", pounds: 11003.9, count: 2, region: null },
    { team: "Martha Robertson", pounds: 10400.0, count: 2, region: null },
    { team: "Todd Cowen", pounds: 9612.5, count: 3, region: null },
    { team: "Todd Saddler", pounds: 8560.0, count: 1, region: null },
    { team: "Karin Suskin", pounds: 8000.0, count: 1, region: null },
    { team: "Wes Ernsberger", pounds: 8000.0, count: 1, region: null },
    { team: "Elizabeth Braymen", pounds: 8000.0, count: 1, region: null },
    { team: "Anne Stork", pounds: 8000.0, count: 1, region: null },
    {
      team: "Lisa (Stratton Charitable Fund)",
      pounds: 8000.0,
      count: 1,
      region: null,
    },
    {
      team: "Dan Broadway and Alice King",
      pounds: 8000.0,
      count: 1,
      region: null,
    },
    { team: "Wells College", pounds: 8000.0, count: 1, region: null },
    { team: "Judy Epstein", pounds: 8000.0, count: 1, region: null },
    { team: "Elizabeth Riley", pounds: 8000.0, count: 1, region: null },
    { team: "Lisa Kilgore", pounds: 8000.0, count: 1, region: null },
    { team: "Luna Oiwa", pounds: 7014.68, count: 5, region: null },
    { team: "Megan", pounds: 6556.58, count: 10, region: null },
    {
      team: "Sierra Club Finger Lakes Group",
      pounds: 6400.0,
      count: 1,
      region: null,
    },
    { team: "Greg Nelson", pounds: 6000.0, count: 1, region: null },
    { team: "R Paul Moore", pounds: 6000.0, count: 1, region: null },
    { team: "Fiana Shapiro", pounds: 5315.8, count: 9, region: null },
    { team: "Sarah Toner", pounds: 5310.01, count: 5, region: null },
    { team: "Terry Carroll", pounds: 5270.24, count: 5, region: null },
    {
      team: "Michael Smith",
      pounds: 5084.219999999999,
      count: 2,
      region: null,
    },
    { team: "Thomas Butler", pounds: 4800.0, count: 1, region: null },
    { team: "Elliot Frost", pounds: 4000.0, count: 1, region: null },
    { team: "gamaypatti@gmail.com", pounds: 4000.0, count: 1, region: null },
    { team: "Joe Burke", pounds: 4000.0, count: 1, region: null },
    { team: "Catriona Breen", pounds: 4000.0, count: 1, region: null },
    { team: "Suresh Sethi", pounds: 4000.0, count: 1, region: null },
    { team: "James Leonard", pounds: 3296.71, count: 1, region: null },
    { team: "Cynthia", pounds: 3207.94, count: 2, region: null },
    {
      team: "Nick Goldsmith",
      pounds: 3127.8199999999997,
      count: 2,
      region: null,
    },
    { team: "Sasha Paris", pounds: 2654.4500000000003, count: 4, region: null },
    { team: "Chris Braymen", pounds: 2000.0, count: 1, region: null },
    { team: "Regi Teasley", pounds: 2000.0, count: 1, region: null },
    { team: "Peter McDonald", pounds: 2000.0, count: 1, region: null },
    { team: "anonymous", pounds: 1888.19, count: 1, region: null },
    { team: "Cheyenne Carter", pounds: 1522.0, count: 3, region: null },
    { team: "David Morris ", pounds: 1356.95, count: 1, region: null },
    { team: "Irene Komor", pounds: 740.41, count: 1, region: null },
    { team: "Colton Poore", pounds: 602.59, count: 1, region: null },
    { team: "James Colket", pounds: 85.22999999999999, count: 2, region: null },
    {
      team: "American Council for an Energy-Efficient Economy",
      pounds: 0,
      count: 0,
      region: null,
    },
    { team: "Matthew Franke-Singer", pounds: 0, count: 0, region: null },
    { team: "Christine Sheppard", pounds: 0, count: 0, region: null },
    { team: "Shimon Edelman", pounds: 0, count: 0, region: null },
    { team: "Ellen Harrison", pounds: 0, count: 0, region: null },
    { team: "Louise Buck", pounds: 0, count: 0, region: null },
    { team: "Emily La", pounds: 0, count: 0, region: null },
    { team: "Rachel Bezner Kerr", pounds: 0, count: 0, region: null },
    { team: "Beth Paris", pounds: 0, count: 0, region: null },
    { team: "Isaac Rabinovitch", pounds: 0, count: 0, region: null },
    { team: "Leslie Potter", pounds: 0, count: 0, region: null },
    { team: '"Campbell\'s"', pounds: 0, count: 0, region: null },
    {
      team: "Unitarian Universalist Church of Canandaigua",
      pounds: 0,
      count: 0,
      region: null,
    },
    { team: "Jessica Rodgers", pounds: 0, count: 0, region: null },
    { team: "Anonymous", pounds: 0, count: 0, region: null },
    { team: "Sara Hess and Jeff Furman", pounds: 0, count: 0, region: null },
    { team: "Sara Culotta", pounds: 0, count: 0, region: null },
    { team: "Brian Eden", pounds: 0, count: 0, region: null },
    { team: "Ithaca High School", pounds: 0, count: 0, region: null },
    { team: "Emilie Wiesner", pounds: 0, count: 0, region: null },
    { team: "Zoë Hare", pounds: 0, count: 0, region: null },
    { team: "Sungineer Solar", pounds: 0, count: 0, region: null },
    { team: "James Lassoie", pounds: 0, count: 0, region: null },
    { team: "Sox Sperry and Lisa Tsetse", pounds: 0, count: 0, region: null },
    { team: "Robert Wolcott", pounds: 0, count: 0, region: null },
    { team: "Mary Loehr", pounds: 0, count: 0, region: null },
    { team: "Irene Liu", pounds: 0, count: 0, region: null },
    { team: "Annie Lewandowski", pounds: 0, count: 0, region: null },
    { team: "Barbara Fry", pounds: 0, count: 0, region: null },
    { team: "Lara Estroff", pounds: 0, count: 0, region: null },
    { team: "Judith Hyman", pounds: 0, count: 0, region: null },
    { team: "Jebediah and Christina Mead", pounds: 0, count: 0, region: null },
    { team: "Jared Jones", pounds: 0, count: 0, region: null },
    {
      team: "Ramapo Catskill Library System",
      pounds: 0,
      count: 0,
      region: null,
    },
    { team: "Charles Geisler", pounds: 0, count: 0, region: null },
    { team: "Philip and Mary Lu McPheron", pounds: 0, count: 0, region: null },
  ];
  res.json(teamFundingData);
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
