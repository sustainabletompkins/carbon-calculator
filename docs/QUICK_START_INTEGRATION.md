# Quick Start: Cart & Offsets Firestore Integration

## What Was Done

Your cart and offsets are now fully integrated with Firestore, with user identification via email addresses. Here's what each component now does:

### 🛒 CartContext
- **Stores cart items** in Firestore `cartItems` collection
- **Uses email as identifier** to sync across devices
- **Persists to localStorage** as fallback
- **Provides loading state** for async operations

### 📦 Cart Component
- **Collects user email** at checkout
- **Syncs cart** from Firestore when email is provided
- **Deletes items** from Firestore when removed
- **Passes email** to payment processing

### 💳 StripeCheckout Component
- **Creates/retrieves user** in Firestore by email
- **Saves offsets** linked to email and Stripe payment ID
- **Marks items as purchased** after successful payment
- **Clears cart** after checkout

### 🔥 Firestore Utilities
- **Cart operations**: save, delete, retrieve, mark purchased
- **User operations**: get or create by email
- **Offset operations**: save, retrieve by user or transaction
- **Error handling**: graceful fallbacks for all operations

## What Happens When User Completes Purchase

1. User adds items to cart
2. User enters email address
3. User clicks "Proceed to Checkout"
4. Email is registered in CartContext
5. **Firestore**: User created in `users` collection (if new)
6. **Stripe**: Payment is processed with email in billing details
7. **Firestore**: Offset records created in `offsets` collection with:
   - `userEmail` (for user lookup)
   - `transactionId` (Stripe Payment Intent ID)
   - Complete offset details
8. **Firestore**: Cart items marked as `purchased: true`
9. Cart is cleared, user sees thank you page

## Firestore Collections Created

### `users`
```
{
  email: "customer@example.com",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### `cartItems`
```
{
  userEmail: "customer@example.com",
  title: "Car Trip",
  cost: 25.00,
  co2: 50.5,
  purchased: false,
  ... (other item details)
}
```

### `offsets`
```
{
  userEmail: "customer@example.com",
  transactionId: "pi_xxxxx",
  stripePaymentIntentId: "pi_xxxxx",
  carbonKg: 50.5,
  cost: 25.00,
  status: "completed",
  ... (other offset details)
}
```

## Database Queries

Here's how to retrieve user data using email:

```javascript
import { getUserOffsets, getUserCartItems, getOrCreateUserByEmail } from '../utils/firestore';

// Get all offsets for a user
const offsets = await getUserOffsets("customer@example.com");

// Get unpurchased cart items for a user
const cart = await getUserCartItems("customer@example.com");

// Get offsets for a specific Stripe transaction
const transactionOffsets = await getTransactionOffsets("pi_xxxxx");

// Get or create user
const user = await getOrCreateUserByEmail("customer@example.com");
```

## Backend Changes Needed

Update your `/api/payment` endpoint to accept and return user email:

```javascript
// Before
POST /api/payment
{ amount: 2500 }

// After
POST /api/payment
{
  amount: 2500,
  userEmail: "customer@example.com"  // NEW
}

Response:
{
  clientSecret: "pi_xxxxx_secret_xxxxx",
  paymentIntentId: "pi_xxxxx",
  userEmail: "customer@example.com"  // Optional but recommended
}
```

## Testing the Integration

### Test 1: Add Items to Cart
```
1. Navigate to app
2. Calculate some carbon offsets
3. Add items to cart
4. Check Firestore > cartItems collection
5. Verify items appear with userEmail = null (email not set yet)
```

### Test 2: Enter Email and Checkout
```
1. From cart, enter test email: test@example.com
2. Click "Proceed to Checkout"
3. Check Firestore > users collection
4. Verify test@example.com user created
5. Check Firestore > cartItems collection
6. Verify items now have userEmail = test@example.com
```

### Test 3: Complete Payment
```
1. Enter valid card: 4242 4242 4242 4242
2. Complete payment
3. Wait for success page
4. Check Firestore > offsets collection
5. Verify offset records created with:
   - userEmail: test@example.com
   - transactionId: pi_xxxxx
   - status: completed
6. Check cartItems, verify purchased: true
```

### Test 4: Query User Data
```javascript
// In browser console or Node.js
import { getUserOffsets, getUserCartItems } from './src/utils/firestore';

// Get all purchases for test email
const offsets = await getUserOffsets("test@example.com");
console.log(`User has ${offsets.length} completed offsets`);

// Get remaining unpurchased items
const cart = await getUserCartItems("test@example.com");
console.log(`User has ${cart.length} items in cart`);
```

## Firestore Indexes Needed

For optimal query performance, create these indexes in Firestore:

```
Collection: cartItems
Fields: userEmail (Ascending), purchased (Ascending)

Collection: offsets
Fields: userEmail (Ascending), timestamp (Descending)

Collection: users
Fields: email (Ascending)
```

## Files Modified

```
✅ src/contexts/CartContext.jsx           - Added Firestore sync & email tracking
✅ src/components/Cart.jsx                - Added email input integration
✅ src/components/StripeCheckout.jsx      - Added user creation & offset saving
✅ src/utils/firestore.js                 - Added 10+ new utility functions
✅ docs/FIRESTORE_CART_OFFSETS_INTEGRATION.md - New comprehensive guide
✅ INTEGRATION_CHANGES.md                 - Change summary & next steps
```

## Error Handling

The system handles errors gracefully:

- **Cart add fails**: Item added to local cart anyway
- **Cart delete fails**: Item removed from local cart anyway
- **Payment succeeds but Firestore fails**: Payment completes, error is logged
- **Firestore unavailable**: Falls back to localStorage

This ensures user experience is never disrupted by temporary outages.

## Key Features

✨ **Email-based User Identification**
- No authentication required
- Links Stripe payment email to user records
- Enables "What did I buy?" lookup

✨ **Multi-Device Cart Sync**
- Same email on different devices = same cart
- Cart persists across sessions via Firestore
- Fallback to localStorage if Firestore unavailable

✨ **Complete Purchase History**
- Every offset linked to user email + Stripe transaction
- Complete audit trail with timestamps
- Query by user, by transaction, or by offset type

✨ **Automatic User Creation**
- Users created on first purchase
- No sign-up process needed
- Email is used as lookup key

## Next Steps

1. ✅ Code changes complete
2. ⏭️ Update backend `/api/payment` endpoint
3. ⏭️ Create Firestore indexes for query performance
4. ⏭️ Test complete checkout flow
5. ⏭️ Add email verification (optional)
6. ⏭️ Build user dashboard to query by email
7. ⏭️ Set up automated receipt emails

## Support & Debugging

### View Firestore Data
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Firestore Database
4. Browse collections: `users`, `cartItems`, `offsets`

### Check Logs
- Browser console: `F12 > Console tab`
- Look for "Cart item saved", "Offset records saved", etc.

### Verify Email is Being Sent
- In Cart.jsx, email is stored as `localUserEmail`
- Passed to StripeCheckout as `userEmail` prop
- Check Network tab: payment request should include `userEmail`

## Questions?

Refer to:
- `docs/FIRESTORE_CART_OFFSETS_INTEGRATION.md` - Complete API reference
- `INTEGRATION_CHANGES.md` - Detailed change summary
- Browser console logs - Debug information
