# Firebase Cloud Function - Little Green Light Webhook Integration

## Overview

This document describes the Firebase Cloud Function integration that automatically sends carbon offset purchase data to the Little Green Light donation management system via webhook.

## How It Works

### Flow Diagram

```
User purchases offset
        ↓
Payment processed by Stripe
        ↓
Offset records saved to Firestore ("offsets" collection)
        ↓
Firebase Cloud Function triggers (onCreate)
        ↓
Function retrieves user data from Firestore
        ↓
Function sends webhook POST request to Little Green Light
        ↓
Function marks record as synced (for idempotency)
```

## Components

### 1. Firebase Cloud Function (`functions/index.js`)

The main function `syncOffsetToLittleGreenLight` triggers whenever a new document is created in the `offsets` collection.

#### Key Features:
- **Event Listener**: Watches `firestore.document("offsets/{offsetId}").onCreate()`
- **Idempotency**: Checks `syncedToLGL` flag to prevent duplicate sends
- **User Data Enrichment**: Retrieves user profile (name, zip code) from Firestore
- **Webhook Delivery**: Sends HTTPS POST request to Little Green Light
- **Error Logging**: Logs failures to a `syncErrors` collection for manual review
- **Automatic Retries**: Throws errors to enable Firebase's automatic retry mechanism

#### Webhook Payload

The function sends the following data to Little Green Light:

```json
{
  "payment_type": "Credit Card",
  "email": "user@example.com",
  "amount": 25.00,
  "name": "John Doe",
  "zip_code": "14850",
  "date": "2025-12-14",
  "fund": "Finger Lakes Climate Fund",
  "offsetType": "car",
  "carbonOffset": 5.5,
  "transactionId": "pi_xxxxx",
  "stripePaymentIntentId": "pi_xxxxx"
}
```

### 2. Frontend Components

#### `Cart.jsx`
- Collects user contact information (email, name, zip code) before checkout
- Displays user information form with optional fields
- Passes user data to `StripeCheckout`

#### `StripeCheckout.jsx`
- Saves/updates user profile in Firestore with provided information
- Includes user data when creating offset records

#### `firestore.js` Utilities
- `getOrCreateUserByEmail()`: Creates user record with optional profile data
- `updateUserProfile()`: Updates existing user profile
- `saveOffsetRecords()`: Saves offset records triggered the webhook

## Setup Instructions

### 1. Install Firebase Functions Dependencies

```bash
cd functions
npm install firebase-admin firebase-functions
```

### 2. Deploy Cloud Function

```bash
firebase deploy --only functions:syncOffsetToLittleGreenLight
```

### 3. Set Environment Variables (Optional)

If you want to customize the webhook URL or add API authentication:

```bash
firebase functions:config:set littlegreenlight.url="https://..."
```

### 4. Monitor Function Execution

View logs in the Firebase Console or via CLI:

```bash
firebase functions:log --limit 50
```

## Firestore Database Schema

### offsets Collection

```javascript
{
  userEmail: "user@example.com",
  transactionId: "pi_xxxxx",
  offsetType: "car|air|home|quick|donation",
  carbonPounds: 12.125,
  carbonKg: 5.5,
  cost: 25.00,
  description: "Car trip: Ithaca to New York (150 miles)",
  origin: "Ithaca, NY",
  destination: "New York, NY",
  distance: 150,
  unit: "miles",
  travelers: 1,
  stripePaymentIntentId: "pi_xxxxx",
  status: "completed",
  timestamp: Timestamp,
  createdAt: "2025-12-14T10:30:00Z",
  syncedToLGL: true,      // Set by function after successful send
  syncedAt: Timestamp     // Set by function after successful send
}
```

### users Collection

```javascript
{
  email: "user@example.com",
  name: "John Doe",           // Optional, collected from form
  zipCode: "14850",           // Optional, collected from form
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### syncErrors Collection (Auto-created)

Stores failures for manual investigation:

```javascript
{
  offsetId: "doc_id",
  errorMessage: "...",
  errorStack: "...",
  timestamp: Timestamp
}
```

## Error Handling

### Automatic Retries

Firebase Cloud Functions automatically retry failed invocations with exponential backoff:
- Initial retry: ~5 seconds
- Maximum retries: 5 attempts over ~7 days

To check retry behavior in logs, look for the execution ID and trace the retry attempts.

### Manual Error Investigation

1. **Check Cloud Function logs** in Firebase Console
2. **Review `syncErrors` collection** in Firestore
3. **Verify webhook URL** is accessible and returning 200+ status
4. **Test manually** by creating a document in the `offsets` collection

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Function timeout | Webhook endpoint slow | Increase function timeout in `firebase.json` |
| SSL/TLS errors | Certificate issue | Verify webhook URL is HTTPS with valid cert |
| 404 Not Found | Wrong webhook URL | Double-check URL in `functions/index.js` |
| Duplicate sends | `syncedToLGL` flag missing | Check Firestore update succeeded |

## Testing

### Manual Test

1. Create a test offset document in Firestore:

```javascript
await db.collection("offsets").add({
  userEmail: "test@example.com",
  offsetType: "car",
  carbonKg: 5.5,
  cost: 25.00,
  status: "completed",
  timestamp: new Date()
});
```

2. Check function logs:

```bash
firebase functions:log --limit 10
```

3. Verify `syncedToLGL` flag is set to `true`

### Emulator Testing

Run locally with Firebase emulator:

```bash
firebase emulators:start --only functions,firestore
```

## Configuration

### Webhook URL

Located in `functions/index.js`, line with:

```javascript
const lglUrl = "https://sustainabletompkins.littlegreenlight.com/integrations/e43d9598-3876-47a8-9411-9a6afdff1647/listener";
```

### Payment Type

Default payment type sent to webhook: `"Credit Card"`

To support other payment methods, modify in `functions/index.js`:

```javascript
payment_type: offsetData.paymentMethod || "Credit Card"
```

### Fund Name

Default fund: `"Finger Lakes Climate Fund"`

To customize per offset type:

```javascript
fund: offsetData.fund || "Finger Lakes Climate Fund"
```

## Monitoring & Alerting

### Firebase Console Alerts

Set up alerts in Cloud Monitoring:
1. Go to Cloud Console → Monitoring → Alerting
2. Create policy for `cloud.googleapis.com/functions/execution_count`
3. Alert on error rate > threshold

### Custom Logging

Add custom metrics to track webhook delivery:

```javascript
// In functions/index.js
const monitoring = require("@google-cloud/monitoring");
// Add custom metric tracking
```

## Troubleshooting

### Function Not Triggering

**Symptoms**: New offset documents created but `syncedToLGL` not set

**Debug Steps**:
1. Verify function is deployed: `firebase functions:list`
2. Check function source code in console
3. Manually invoke via test documents
4. Check `--debug` logs: `firebase functions:log --debug`

### Webhook Not Receiving Data

**Symptoms**: Function logs show success, but LGL shows no donations

**Debug Steps**:
1. Enable detailed logging in `functions/index.js`
2. Add console.log for payload before sending
3. Check webhook endpoint access logs
4. Verify payload format matches LGL expectations
5. Test webhook with curl:

```bash
curl -X POST https://sustainabletompkins.littlegreenlight.com/integrations/... \
  -H "Content-Type: application/json" \
  -d '{
    "payment_type": "Credit Card",
    "email": "test@example.com",
    "amount": 25.00,
    "name": "Test User",
    "zip_code": "14850",
    "date": "2025-12-14",
    "fund": "Finger Lakes Climate Fund"
  }'
```

## Maintenance

### Regular Tasks

- **Weekly**: Review `syncErrors` collection for failures
- **Monthly**: Verify webhook endpoint accessibility
- **Quarterly**: Audit function logs for performance issues

### Updating Function Logic

1. Edit `functions/index.js`
2. Test locally: `firebase emulators:start`
3. Deploy: `firebase deploy --only functions`
4. Verify deployment success in console

## Future Enhancements

- [ ] Add support for different payment methods (ACH, check, etc.)
- [ ] Implement webhook signature verification
- [ ] Add Pub/Sub for decoupled delivery
- [ ] Support batch operations for high-volume days
- [ ] Add custom metrics to Firebase Analytics

## References

- [Firebase Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Firestore Triggers](https://firebase.google.com/docs/functions/firestore-examples)
- [Little Green Light API](https://support.littlegreenlight.com/hc/en-us/sections/206410606-API)
- [Stripe Payment Intents](https://stripe.com/docs/payments/payment-intents)
