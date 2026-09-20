# Stripe Integration Setup Guide

## Overview

Your Carbon Calculator now has full Stripe payment integration. The checkout button on the Cart page will process payments securely.

## What's Been Set Up

### Frontend Components

- **StripeCheckout.jsx** - Modal component with Stripe card form
- **Cart.jsx** - Updated with checkout button that opens the payment modal
- **main.jsx** - Configured with Stripe Elements provider

### Backend Server

- **server.js** - Express server with payment processing endpoints
- Handles payment intent creation and confirmation
- Includes webhook support for Stripe events

## Running the Application

### Option 1: Run both frontend and backend together

```bash
npm run dev:all
```

This runs the Vite dev server and Express server concurrently.

### Option 2: Run separately

Terminal 1 (Backend):

```bash
npm run server
```

Terminal 2 (Frontend):

```bash
npm run dev
```

## Environment Variables

Your `.env` file should already have:

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...   # server-only, no VITE_ prefix
VITE_API_URL=http://localhost:3000
```

## Testing Payment Flow

### Using Stripe Test Cards

Use these card numbers to test:

**Successful Payment:**

- Card Number: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)

**Failed Payment:**

- Card Number: `4000 0000 0000 0002`
- Expiry: Any future date
- CVC: Any 3 digits

**Requires Authentication:**

- Card Number: `4000 0025 0000 3155`
- Expiry: Any future date
- CVC: Any 3 digits

## API Endpoints

### POST `/api/payment`

Processes a payment with a payment method ID.

**Request:**

```json
{
  "amount": 2550,
  "paymentMethodId": "pm_1234567890"
}
```

**Response (Success):**

```json
{
  "success": true,
  "id": "pi_1234567890",
  "status": "succeeded",
  "amount": 2550
}
```

### POST `/api/create-payment-intent`

Creates a payment intent (alternative approach).

**Request:**

```json
{
  "amount": 2550
}
```

**Response:**

```json
{
  "clientSecret": "pi_1234567890_secret_xyz",
  "id": "pi_1234567890"
}
```

### POST `/api/webhooks/stripe`

Receives and processes Stripe webhook events.

**Handles:**

- `payment_intent.succeeded` - Successful payment
- `payment_intent.payment_failed` - Failed payment
- `charge.refunded` - Refunds

## Setting Up Webhooks (Optional)

To receive real-time payment events:

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to Developers → Webhooks
3. Add Endpoint: `https://yoursite.com/api/webhooks/stripe`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Copy the Webhook Secret and add to `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## Checkout Flow

1. User adds items to cart
2. Clicks "Proceed to Checkout"
3. Modal opens with Stripe card form
4. User enters card details
5. Payment is processed:
   - Frontend sends card details and amount to backend
   - Backend creates Payment Intent with Stripe
   - Backend confirms payment
6. On success:
   - Cart is cleared
   - User sees success message
   - Redirected to car calculator

## Troubleshooting

### Payment Fails with "API key not found"

- Verify `STRIPE_SECRET_KEY` is set in `.env`
- Restart the server: `npm run server`

### CORS Error

- Check that `VITE_API_URL` matches your backend URL
- Ensure CORS is enabled in `server.js`

### Card Element Not Appearing

- Verify `VITE_STRIPE_PUBLISHABLE_KEY` is correct
- Check browser console for errors
- Clear browser cache and reload

### Payment Processing Hangs

- Check server logs for errors
- Verify Stripe keys are valid
- Try a test card number

## Production Deployment

Before going live:

1. Switch to live Stripe keys (remove `pk_test_` and `sk_test_`)
2. Update `VITE_API_URL` to your production backend URL
3. Set up webhook endpoint in Stripe dashboard
4. Enable HTTPS for all endpoints
5. Never commit `.env` with real keys to git
6. Use environment variables from your hosting provider

## Security Notes

⚠️ **Important Security Reminders:**

- Never prefix the secret key or webhook secret with `VITE_` — Vite bundles every `VITE_*` variable into the public browser build
- The backend server keeps secret key safe
- Always validate amounts on the backend
- Implement proper authentication for payment endpoints
- Use HTTPS in production
- Keep `server.js` keys secure

## Support

For Stripe integration issues:

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe React Stripe JS](https://stripe.com/docs/stripe-js/react)
- [Express + Stripe Guide](https://stripe.com/docs/stripe-js/elements/quickstart)
