# Implementation Summary: Firestore Cart & Offsets Integration

## Changes Made

### 1. **Enhanced Firestore Utilities** (`src/utils/firestore.js`)

Added comprehensive functions for cart and user management:

**Cart Functions:**
- `saveCartItem(userEmail, item)` - Saves cart items to Firestore
- `deleteCartItem(docId)` - Removes cart items from Firestore
- `getUserCartItems(userEmail)` - Retrieves unpurchased cart items
- `markCartItemsAsPurchased(cartItemIds)` - Marks items as purchased after payment

**User Functions:**
- `getOrCreateUserByEmail(email)` - Gets or creates user by email (links Stripe emails to Firestore users)
- `getUserOffsets(userEmail)` - Retrieves all offsets for a user
- `getTransactionOffsets(transactionId)` - Retrieves offsets for a specific Stripe transaction
- `updateOffsetsWithStripeData(offsetIds, stripePaymentIntentId)` - Updates offsets with Stripe info

**Offset Functions:**
- Enhanced `saveOffsetRecords()` to include Stripe payment intent ID and status

### 2. **Updated CartContext** (`src/contexts/CartContext.jsx`)

Made context Firestore-aware with email-based persistence:

**Key Changes:**
- Added `userEmail` state to track the current user's email
- Added `loading` state for async operations
- Implemented `loadCartFromFirestore()` to sync cart when email is provided
- Modified `addToCart()` to automatically save to Firestore when email is set
- Modified `removeFromCart()` to automatically delete from Firestore
- Added `setUserEmail()` function to set user email in context
- Added callbacks for all async operations with error handling

**Benefits:**
- Cart persists across browser sessions via Firestore
- Multiple devices can share same cart (via email)
- Cart items are indexed by email for quick retrieval

### 3. **Updated Cart Component** (`src/components/Cart.jsx`)

Integrated email management and Firestore sync:

**Key Changes:**
- Changed email state management to use `localUserEmail` for form input
- Initialize local email from context on mount
- Pass local email to StripeCheckout
- Updated context to call `setUserEmail()` when checkout is clicked
- Updated helper text to explain email linking

**User Flow:**
1. User adds items to cart (saved to Firestore if email was previously set)
2. User enters email address
3. User clicks "Proceed to Checkout"
4. Email is set in CartContext (triggers Firestore load if not already set)
5. Payment modal opens with email linked

### 4. **Enhanced StripeCheckout Component** (`src/components/StripeCheckout.jsx`)

Complete Firestore and user integration:

**Key Changes:**
- Call `getOrCreateUserByEmail()` to create/retrieve user record before payment
- Pass `userEmail` to backend payment endpoint for context
- Pass `userEmail` in card billing details to Stripe
- Enhanced offset record saving with cart item IDs for purchasing
- Added `markCartItemsAsPurchased()` to track purchased items
- Updated success response to include `userEmail`

**Payment Flow:**
1. Ensure user exists in Firestore (create if needed)
2. Create Stripe payment intent (with email context)
3. Confirm card payment
4. Save offset records linked to email and transaction ID
5. Mark cart items as purchased
6. Clear local cart
7. Show success

### 5. **New Documentation** (`docs/FIRESTORE_CART_OFFSETS_INTEGRATION.md`)

Comprehensive integration guide covering:
- Architecture and data flow
- Firestore collection schemas
- Component changes and usage
- All utility functions
- Email-based user linking strategy
- Backend integration requirements
- Testing procedures
- Migration guidance
- Error handling
- Troubleshooting

## Data Linking Strategy

### Email as Primary Key

The system uses **email addresses** to link:

```
Stripe Payment Email
        ↓
    User Record (email indexed)
        ↓
    Cart Items (userEmail field)
    ↓
    Offsets (userEmail + stripePaymentIntentId fields)
```

**Advantages:**
- No authentication required (anonymous checkout)
- Single query parameter for all lookups
- Matches Stripe customer email
- Supports multi-device access
- User recovery: "What did I buy with this email?"

### Record Relationships

```
users collection:
├── email (indexed)
├── createdAt
└── updatedAt

cartItems collection:
├── userEmail (indexed)  → joins to users.email
├── purchased (flag)
├── createdAt
└── [item details]

offsets collection:
├── userEmail (indexed)  → joins to users.email
├── transactionId (indexed) → Stripe Payment Intent
├── stripePaymentIntentId
├── status
└── [offset details]
```

## Firestore Collections Summary

| Collection | Purpose | Records | Indexed By |
|-----------|---------|---------|-----------|
| `users` | User profiles | 1 per email | email |
| `cartItems` | Pending purchases | Multiple per user | userEmail, purchased |
| `offsets` | Completed purchases | Multiple per user | userEmail, transactionId |

## API Integration Points

### Backend Payment Endpoint

Should now accept and return:

```javascript
// Request
POST /api/payment
{
  amount: 2500,
  userEmail: "user@example.com"
}

// Response
{
  clientSecret: "pi_xxxxx_secret_xxxxx",
  paymentIntentId: "pi_xxxxx"
}
```

### Cart Item Storage

Items now include:
- `userEmail` - for multi-device sync
- `id` (Firestore doc ID) - for deletion
- `purchased` flag - to track completed purchases

### Offset Creation

Offsets now include:
- `userEmail` - for user identification
- `stripePaymentIntentId` - for transaction linkage
- `status: "completed"` - for status tracking
- Complete payment details

## Error Handling

Graceful fallbacks implemented:

| Operation | Failure | Behavior |
|-----------|---------|----------|
| Save cart item | Firestore error | Item added to local cart |
| Delete cart item | Firestore error | Item removed from local cart |
| Save offsets | Firestore error | Payment still succeeds, error logged |
| Load cart | Firestore error | Fall back to localStorage |
| Create user | Already exists | Retrieves existing user |

## Testing Checklist

- [ ] Add items to cart without email
- [ ] Enter email and verify cart syncs from Firestore
- [ ] Remove items from cart and verify Firestore deletion
- [ ] Complete payment and verify:
  - [ ] User created in `users` collection
  - [ ] Offsets created in `offsets` collection with email and transaction ID
  - [ ] Cart items marked as `purchased: true`
  - [ ] Cart cleared locally
- [ ] Query offsets by email: `getUserOffsets("email")`
- [ ] Query offsets by transaction: `getTransactionOffsets("pi_xxxxx")`
- [ ] Verify Firestore payment intent ID stored correctly

## Next Steps

1. **Update Backend** - Modify `/api/payment` endpoint to accept and log `userEmail`
2. **Security Rules** - Implement Firestore security rules for email-based access
3. **Testing** - Run through complete checkout flow
4. **Monitoring** - Add logging and monitoring for Firestore operations
5. **User Dashboard** - Create dashboard to retrieve user's offsets by email
6. **Email Receipts** - Send purchase confirmation to user email

## File Modifications Summary

```
src/
├── contexts/CartContext.jsx (UPDATED)
├── components/
│   ├── Cart.jsx (UPDATED)
│   └── StripeCheckout.jsx (UPDATED)
└── utils/
    └── firestore.js (UPDATED)

docs/
└── FIRESTORE_CART_OFFSETS_INTEGRATION.md (CREATED)
```

## Backward Compatibility

- Migration scripts remain unchanged
- Existing Firestore collections preserved
- New cart items and offsets use Firestore-generated IDs
- System gracefully handles both migrated and newly-created records
