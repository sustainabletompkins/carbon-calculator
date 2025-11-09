# Carbon Offset Records - Architecture & Data Flow

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CARBON CALCULATOR APP                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │  Air Calculator  │  │  Car Calculator  │  │ Home/Quick   │   │
│  │                  │  │                  │  │ Calculators  │   │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘   │
│           │                     │                    │           │
│           └─────────────────────┼────────────────────┘           │
│                                 ▼                                 │
│                        ┌──────────────────┐                       │
│                        │   Cart Context   │                       │
│                        │   (localStorage) │                       │
│                        └────────┬─────────┘                       │
│                                 │                                 │
│                                 ▼                                 │
│                        ┌──────────────────┐                       │
│                        │   Cart Component │                       │
│                        │                  │                       │
│                        │  - Email Input   │                       │
│                        │  - Display Items │                       │
│                        │  - Total Summary │                       │
│                        └────────┬─────────┘                       │
│                                 │                                 │
│                                 ▼                                 │
│                    ┌──────────────────────┐                       │
│                    │  Stripe Checkout    │                       │
│                    │     Component       │                       │
│                    │                     │                       │
│                    │  - Collect payment  │                       │
│                    │  - Verify card      │                       │
│                    └────────┬────────────┘                       │
│                             │                                     │
│         ┌───────────────────┼───────────────────┐                │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│    ┌─────────┐          ┌──────────┐      ┌─────────────────┐   │
│    │  Stripe │          │ Node.js  │      │ Firestore Utils │   │
│    │  API    │          │ Backend  │      │ (saveOffsets)   │   │
│    └─────────┘          └──────────┘      └────────┬────────┘   │
│         ▲                   ▲                       │             │
│         │                   │                       │             │
│         └──────────┬────────┘                       │             │
│                    │                                │             │
│                    │ Payment Intent ID             │             │
│                    └────────────────────────────────┼─────────┐   │
│                                                     │         │   │
│                                                     ▼         ▼   │
│                                            ┌──────────────────┐   │
│                                            │  Firebase SDK    │   │
│                                            │  (Firestore)     │   │
│                                            └──────────────────┘   │
│                                                     │              │
└─────────────────────────────────────────────────────┼──────────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────┐
                                            │ Firebase Cloud   │
                                            │ Firestore DB     │
                                            │                  │
                                            │ ┌──────────────┐ │
                                            │ │  offsets     │ │
                                            │ │ collection   │ │
                                            │ │  (documents) │ │
                                            │ └──────────────┘ │
                                            └──────────────────┘
```

## Data Flow Diagram

### User Journey

```
User Action                 Component/Module        Data Saved
─────────────────────────────────────────────────────────────────

1. Calculates Trip    →    AirCalculator          [origin, destination,
                           CarCalculator          distance, co2, cost]
                           HomeCalculator
                           QuickOffset

                           ↓

2. Adds to Cart       →    CartContext.addToCart   [item saved to
                                                   localStorage]

                           ↓

3. Views Cart         →    Cart Component          [displays all items
                                                   from localStorage]

                           ↓

4. Enters Email       →    Cart Component          [validates email
                           (required)              format]

                           ↓

5. Clicks Checkout    →    StripeCheckout          [opens payment modal
                                                   with all props]

                           ↓

6. Enters Payment     →    Stripe API              [processes payment
   Details                                         & returns intent ID]

                           ↓

7. Payment           →     saveOffsetRecords()     [For each cart item:
   Succeeds                                        {
                                                    userEmail
                                                    transactionId
                                                    offsetType
                                                    carbonKg
                                                    carbonPounds
                                                    cost
                                                    description
                                                    origin
                                                    destination
                                                    distance
                                                    travelers
                                                    timestamp
                                                   }]

                           ↓

8. Records Saved      →    Firestore offsets       [documents created
                           collection              in offsets collection]

                           ↓

9. Thank You Page     →    ThankYou Component      [displays payment ID]

                           ↓

10. Cart Cleared      →    CartContext.clearCart() [localStorage cleared]
```

## File Structure & Dependencies

```
src/
├── components/
│   ├── CarbonCalculator.jsx (main orchestrator)
│   ├── AirCalculator.jsx
│   ├── CarCalculator.jsx
│   ├── HomeCalculator.jsx
│   ├── QuickOffset.jsx
│   ├── Cart.jsx ⭐ (NEW: email input, passes cartItems/userEmail)
│   ├── StripeCheckout.jsx ⭐ (NEW: saves offsets to Firestore)
│   └── ThankYou.jsx
│
├── contexts/
│   └── CartContext.jsx (manages cart state)
│
├── utils/
│   ├── routesApi.js
│   └── firestore.js ⭐ (NEW: Firestore operations)
│
└── firebase.js ⭐ (UPDATED: added Firestore)
```

## Component Props Flow

```
CarbonCalculator
    └── CartContext.Provider
        ├── AirCalculator
        │   └── [add to cart]
        ├── CarCalculator
        │   └── [add to cart]
        ├── HomeCalculator
        │   └── [add to cart]
        ├── QuickOffset
        │   └── [add to cart]
        ├── Cart
        │   ├── receives: setActiveTab, onPaymentSuccess
        │   ├── manages: userEmail state, email validation
        │   └── passes to StripeCheckout:
        │       ├── totalAmount
        │       ├── cartItems ⭐
        │       ├── userEmail ⭐
        │       ├── onSuccess callback
        │       └── onCancel callback
        │
        └── StripeCheckout
            ├── receives: cartItems, userEmail ⭐
            ├── processes: Stripe payment
            ├── on success: calls saveOffsetRecords(userEmail, transactionId, cartItems)
            └── then: calls onSuccess callback
```

## Firestore Collection Structure

```
Firestore
│
└── offsets (Collection)
    │
    ├── Document 1 (auto-generated ID)
    │   ├── userEmail: "john@example.com"
    │   ├── transactionId: "pi_123abc"
    │   ├── offsetType: "air"
    │   ├── carbonKg: 680
    │   ├── carbonPounds: 1500.5
    │   ├── cost: 68.00
    │   ├── description: "Air travel: NYC → LAX (2451 miles)"
    │   ├── origin: "New York"
    │   ├── destination: "Los Angeles"
    │   ├── distance: 2451
    │   ├── unit: "miles"
    │   ├── travelers: 1
    │   ├── timestamp: 2024-11-09T15:30:00Z
    │   └── createdAt: "2024-11-09T15:30:00.000Z"
    │
    ├── Document 2 (same transaction)
    │   ├── userEmail: "john@example.com"
    │   ├── transactionId: "pi_123abc" ← Same ID!
    │   ├── offsetType: "car"
    │   ├── carbonKg: 200
    │   ├── carbonPounds: 440
    │   ├── cost: 20.00
    │   ├── description: "Car trip: Boston → New York (215 miles)"
    │   ├── origin: "Boston"
    │   ├── destination: "New York"
    │   ├── distance: 215
    │   ├── unit: "miles"
    │   ├── travelers: 1
    │   ├── timestamp: 2024-11-09T15:30:00Z
    │   └── createdAt: "2024-11-09T15:30:00.000Z"
    │
    └── Document 3 (different transaction, same user)
        ├── userEmail: "john@example.com"
        ├── transactionId: "pi_456def" ← Different ID!
        ├── offsetType: "home"
        ├── carbonKg: 100
        ├── carbonPounds: 220
        ├── cost: 10.00
        ├── description: "Home energy offset: 100 kg CO2"
        ├── distance: null
        ├── travelers: 1
        ├── timestamp: 2024-11-08T10:15:00Z
        └── createdAt: "2024-11-08T10:15:00.000Z"
```

## Query Patterns

```
                    Query Pattern Examples
                    ─────────────────────

┌─ By User Email ─────────────────────────┐
│  WHERE userEmail == "john@example.com"  │
│  Returns: All offsets for this user     │
└─────────────────────────────────────────┘

┌─ By Transaction ────────────────────────┐
│  WHERE transactionId == "pi_123abc"     │
│  Returns: All items from one purchase   │
└─────────────────────────────────────────┘

┌─ By Offset Type ────────────────────────┐
│  WHERE offsetType == "air"              │
│  Returns: All air travel offsets        │
└─────────────────────────────────────────┘

┌─ By User + Type ────────────────────────┐
│  WHERE userEmail == "john@example.com"  │
│  AND offsetType == "air"                │
│  Returns: This user's air travel only   │
└─────────────────────────────────────────┘

┌─ Sorted by Date ────────────────────────┐
│  ORDER BY timestamp DESC                │
│  Returns: Newest offsets first          │
└─────────────────────────────────────────┘

┌─ Summary Statistics ────────────────────┐
│  SELECT:                                │
│    COUNT(offsetType)                    │
│    SUM(carbonKg)                        │
│    SUM(cost)                            │
│  WHERE userEmail == "john@example.com"  │
│  GROUP BY offsetType                    │
│  Returns: Stats by offset type          │
└─────────────────────────────────────────┘
```

## Error Handling Flow

```
Payment Flow Error Handling
──────────────────────────

Start Payment
    │
    ├─ Stripe Error?
    │  └─ Display error in modal
    │     └─ User can retry or cancel
    │
    ├─ Payment Succeeds?
    │  └─ YES → Save to Firestore
    │
    ├─ Firestore Error?
    │  ├─ Log error to console
    │  ├─ Don't block payment success
    │  └─ Notify user (optional)
    │
    └─ Success
       ├─ Clear cart
       ├─ Show thank you
       └─ Navigate away
```

## Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `firebase.js` | Added Firestore import & export | Enable Firestore access |
| `firestore.js` | New file | Utility functions for saving/querying offsets |
| `Cart.jsx` | Added email input & validation | Collect user email for records |
| `StripeCheckout.jsx` | Added offset save logic | Save records after payment |

## Key Integration Points

1. **Cart → StripeCheckout**: Passes `cartItems` and `userEmail`
2. **StripeCheckout → Firestore**: Calls `saveOffsetRecords()` on payment success
3. **Firestore → Database**: Creates individual documents per cart item
4. **Transaction Linking**: All items share same `transactionId`
5. **Individual Tracking**: Each item has separate `offsetType` for filtering

## Benefits of This Architecture

✅ **Atomicity**: Each item is an independent record (easier to update/delete)
✅ **Traceability**: Transaction ID links all items from one purchase
✅ **Flexibility**: Can query and analyze by offset type, user, date, etc.
✅ **Scalability**: Firestore auto-scales with data growth
✅ **Real-time**: Can use Firestore listeners for live updates
✅ **Analytics**: Easy to run queries for reporting
