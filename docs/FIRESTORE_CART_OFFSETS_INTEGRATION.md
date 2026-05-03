# Firestore Cart & Offsets Integration Guide

## Overview

This guide documents the integration of cart items and carbon offsets with Firestore, linked to users via email addresses. The system creates user records on-the-fly using the Stripe payment email address and maintains a complete purchase history.

## Architecture

### Data Flow

```
User adds items to cart
    ↓
CartContext saves items to Firestore "cartItems" collection (userEmail-indexed)
    ↓
User enters email at checkout
    ↓
Payment processed via Stripe
    ↓
Creates/retrieves user record in "users" collection (email-indexed)
    ↓
Saves offset records to "offsets" collection linked to userEmail and Stripe transactionId
    ↓
Marks cart items as "purchased" in Firestore
    ↓
Cart cleared from localStorage and Firestore
```

## Firestore Collections

### 1. Users Collection (`users`)

Stores minimal user information using email as the linking key.

```javascript
{
  id: "auto-generated",
  email: "user@example.com",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Purpose**: Links Stripe payments (via email) to user records. Enables user-centric queries.

### 2. Cart Items Collection (`cartItems`)

Stores items added to the user's cart before checkout.

```javascript
{
  id: "auto-generated",
  userEmail: "user@example.com",
  title: "Car Trip",
  cost: 25.00,
  co2: 50.5,  // kg of CO2
  tripMode: "car",  // car, air, home, quick
  type: "offset",   // offset or donation
  origin: "San Francisco, CA",
  destination: "Los Angeles, CA",
  distance: 380,    // miles
  travelers: 2,
  description: "Car trip: San Francisco, CA → Los Angeles, CA (380.00 miles)",
  purchased: false,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Purpose**: Persists cart state across sessions. Tracks incomplete purchases.

### 3. Offsets Collection (`offsets`)

Stores completed carbon offset purchases linked to payment transactions.

```javascript
{
  id: "auto-generated",
  userEmail: "user@example.com",
  transactionId: "pi_xxxxx",  // Stripe Payment Intent ID
  stripePaymentIntentId: "pi_xxxxx",
  offsetType: "car",
  carbonPounds: 111.33,    // CO2 in pounds
  carbonKg: 50.5,          // CO2 in kg (original)
  cost: 25.00,
  description: "Car trip: San Francisco, CA → Los Angeles, CA (380.00 miles)",
  origin: "San Francisco, CA",
  destination: "Los Angeles, CA",
  distance: 380,
  unit: "miles",
  travelers: 2,
  status: "completed",
  timestamp: Timestamp,
  createdAt: "2024-11-23T10:30:00Z"
}
```

**Purpose**: Permanent record of all carbon offsets purchased. Linked to Stripe for accounting and user identification.

## Component Changes

### CartContext (`src/contexts/CartContext.jsx`)

**Key Changes**:

- Added `userEmail` and `setUserEmail` to context
- Implemented `loadCartFromFirestore()` to sync with Firestore when email is set
- Modified `addToCart()` to save items to Firestore if user email is set
- Modified `removeFromCart()` to delete items from Firestore if they have an ID

**Usage**:

```javascript
const { cart, addToCart, removeFromCart, clearCart, userEmail, setUserEmail } =
  useContext(CartContext);

// When user enters email at checkout
setUserEmail(userEmail);
```

### Cart Component (`src/components/Cart.jsx`)

**Key Changes**:

- Tracks local `localUserEmail` state
- Updates context `setUserEmail` when checkout is clicked
- Passes user email through to StripeCheckout
- Updated help text to explain email linking

**Flow**:

1. User enters email
2. User clicks "Proceed to Checkout"
3. Email is set in CartContext
4. StripeCheckout opens with email passed as prop

### StripeCheckout Component (`src/components/StripeCheckout.jsx`)

**Key Changes**:

- Calls `getOrCreateUserByEmail()` before creating payment intent
- Passes `userEmail` to backend payment endpoint
- Calls `saveOffsetRecords()` with `userEmail` and Stripe payment intent ID
- Calls `markCartItemsAsPurchased()` to mark cart items as purchased
- Returns `userEmail` in success response

**Flow**:

1. User or create user in Firestore
2. Create Stripe payment intent (with user email context)
3. Confirm card payment with Stripe
4. Save offset records linked to email
5. Mark cart items as purchased
6. Clear cart and show success

## Firestore Utility Functions (`src/utils/firestore.js`)

### Cart Item Functions

#### `saveCartItem(userEmail, item)`

Saves a single item to the `cartItems` collection.

```javascript
const docId = await saveCartItem("user@example.com", cartItem);
```

#### `deleteCartItem(docId)`

Deletes a cart item by document ID.

```javascript
await deleteCartItem(docId);
```

#### `getUserCartItems(userEmail)`

Retrieves all unpurchased cart items for a user.

```javascript
const cartItems = await getUserCartItems("user@example.com");
```

#### `markCartItemsAsPurchased(cartItemIds)`

Marks cart items as purchased after successful payment.

```javascript
await markCartItemsAsPurchased(["docId1", "docId2"]);
```

### User Functions

#### `getOrCreateUserByEmail(email)`

Gets user record if exists, creates if not.

```javascript
const user = await getOrCreateUserByEmail("user@example.com");
// Returns: { id: "userId", email: "user@example.com", createdAt, updatedAt }
```

### Offset Functions

#### `saveOffsetRecords(userEmail, transactionId, cartItems)`

Saves offset records for each cart item after successful payment.

```javascript
const offsetIds = await saveOffsetRecords(
  "user@example.com",
  "pi_xxxxx",
  cartItems
);
```

#### `getUserOffsets(userEmail)`

Retrieves all offset records for a user.

```javascript
const offsets = await getUserOffsets("user@example.com");
```

#### `getTransactionOffsets(transactionId)`

Retrieves offset records for a specific Stripe transaction.

```javascript
const offsets = await getTransactionOffsets("pi_xxxxx");
```

#### `updateOffsetsWithStripeData(offsetIds, stripePaymentIntentId)`

Updates offset records with Stripe payment information.

```javascript
await updateOffsetsWithStripeData(["offsetId1"], "pi_xxxxx");
```

## Firestore Security Rules

Recommended security rules to implement:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - readable by themselves
    match /users/{document=**} {
      allow read: if request.auth.token.email == resource.data.email;
      allow write: if false; // Only backend can write
    }

    // Cart items - readable/writable by user email
    match /cartItems/{document=**} {
      allow read: if request.query.where('userEmail', '==', request.auth.token.email).exists();
      allow write: if false; // Only backend can write
    }

    // Offsets - readable by user email
    match /offsets/{document=**} {
      allow read: if request.query.where('userEmail', '==', request.auth.token.email).exists();
      allow write: if false; // Only backend can write
    }
  }
}
```

## Email-Based User Linking

The system uses email addresses as the primary linking mechanism between:

1. **Stripe Customers**: Customer email from payment details
2. **Firestore Users**: User document identified by email
3. **Cart Items**: Associated with user email
4. **Offsets**: Associated with user email and Stripe transaction ID

### Advantages

- No authentication required (anonymous purchase option)
- Email-based lookups for transaction history
- Enables sending purchase receipts via email
- Supports user recovery ("What did I buy with this email?")

### Implementation

- User provides email at checkout (required field)
- Email is validated before payment
- Email is passed through to Firestore
- All records are indexed by email for quick lookups

## Backend Integration

The backend payment endpoint should accept `userEmail`:

```javascript
POST /api/payment
{
  amount: 2500,  // cents
  userEmail: "user@example.com"
}

Response:
{
  clientSecret: "pi_xxxxx_secret_xxxxx",
  paymentIntentId: "pi_xxxxx"
}
```

## Testing the Integration

### 1. Add items to cart

- Verify items appear in local cart
- Check `cartItems` collection in Firestore

### 2. Enter email and checkout

- Verify user record created in `users` collection
- Check cart items in Firestore still exist

### 3. Complete payment

- Verify offset records created in `offsets` collection
- Verify cart items marked as `purchased: true`
- Verify Stripe payment intent ID is stored

### 4. Retrieve user data

```javascript
// Get all offsets for user
const offsets = await getUserOffsets("user@example.com");

// Get remaining cart items
const cartItems = await getUserCartItems("user@example.com");

// Get offsets for specific transaction
const transactionOffsets = await getTransactionOffsets("pi_xxxxx");
```

## Migration from Existing Data

The migration scripts in `/scripts` already handle:

- `migrateUsersToFirestore.js` - Migrates users to Firestore
- `migrateCartItemsToFirestore.js` - Migrates cart items
- `migrateOffsetsToFirestore.js` - Migrates existing offsets

Note: These migrations use existing IDs from PostgreSQL. New cart items and offsets created through the UI will have Firestore-generated IDs.

## Error Handling

The system gracefully handles Firestore failures:

1. **Add to Cart**: Item added to local cart even if Firestore save fails
2. **Remove from Cart**: Item removed locally even if Firestore delete fails
3. **Payment Processing**: Payment completes even if Firestore save fails (logged for debugging)

This ensures the user experience is not disrupted by temporary Firestore outages.

## Future Enhancements

1. **Email Verification**: Send confirmation email to verify address
2. **User Dashboard**: Create dashboard to view all purchases by email lookup
3. **Offline Sync**: Sync cart items when connection restored
4. **Batch Operations**: Optimize large bulk operations
5. **Audit Logging**: Track all Firestore modifications for compliance
6. **Analytics**: User engagement metrics by offset type

## Troubleshooting

### Cart items not persisting

- Check user email is set in context
- Verify Firestore `cartItems` collection has appropriate permissions
- Check browser console for Firestore errors

### Offsets not saving after payment

- Verify user email was passed to payment endpoint
- Check Firestore `offsets` collection has write permissions
- Verify Stripe payment intent ID is being returned correctly

### User lookup by email returns no results

- Ensure email matches exactly (case-sensitive)
- Check user was created in `users` collection
- Verify Firestore query indexes exist for email lookups

## References

- [Migration Guide](/scripts/MIGRATION_GUIDE.md)
- [Firestore Setup](/docs/FIRESTORE_SETUP.md)
- [Firestore Queries](/docs/FIRESTORE_QUERIES_EXAMPLES.md)
- [Stripe Setup](/docs/STRIPE_SETUP.md)
