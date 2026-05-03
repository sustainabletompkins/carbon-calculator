# Firestore Integration - Debugging & Reference

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐         ┌──────────────────┐           │
│  │  Cart Component │────────→│  CartContext     │           │
│  └─────────────────┘         └──────────────────┘           │
│         │                            │                       │
│         │ setUserEmail()             │ tracks userEmail      │
│         ├─────────────────────────────┤                      │
│         │                             │                      │
│         v                             v                      │
│  ┌─────────────────────────────────────────────┐            │
│  │  Firestore saveCartItem()                   │            │
│  │  getUserCartItems()                         │            │
│  │  deleteCartItem()                           │            │
│  │  markCartItemsAsPurchased()                 │            │
│  └─────────────────────────────────────────────┘            │
│         │                                                    │
│         v                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ StripeCheckout Component                             │  │
│  │ - Gets or creates user by email                      │  │
│  │ - Processes payment                                  │  │
│  │ - Calls saveOffsetRecords()                          │  │
│  │ - Calls markCartItemsAsPurchased()                   │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                                                    │
│         v                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Backend /api/payment                                 │  │
│  │ - Creates Stripe Payment Intent                      │  │
│  │ - Returns clientSecret for confirmation              │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                                                    │
└─────────┼────────────────────────────────────────────────────┘
          │
          v
    ┌──────────────────────┐
    │    Stripe API        │
    │ - Confirms Payment   │
    │ - Returns Status     │
    └──────────────────────┘
          │
          v
    ┌────────────────────────────┐
    │   Cloud Firestore          │
    ├────────────────────────────┤
    │ Collections:               │
    │ - users                    │
    │ - cartItems                │
    │ - offsets                  │
    └────────────────────────────┘
```

## Data Flow: Adding Item to Cart

```
1. User adds offset item (e.g., car trip)
   └→ addToCart(item) called

2. CartContext.addToCart()
   ├─ If userEmail is set:
   │  └→ saveCartItem(userEmail, item)
   │     └→ Firestore adds to cartItems collection
   │        ├─ userEmail
   │        ├─ title, cost, co2
   │        └─ purchased: false
   │
   └─ Add to local cart state
      └→ localStorage persists

3. Item appears in cart UI
   └→ User sees it immediately
```

## Data Flow: Checkout Process

```
1. User enters email: "user@example.com"
2. User clicks "Proceed to Checkout"
   └→ setUserEmail("user@example.com") called
   └→ CartContext saves email
   └→ Firestore loads existing cart for that email

3. StripeCheckout opens
   └→ userEmail prop: "user@example.com"

4. User fills card and clicks Pay
   └→ handleSubmit() called

5. getOrCreateUserByEmail("user@example.com")
   ├─ Query Firestore users collection
   ├─ If exists: return user
   └─ If not: create new user with email

6. Backend /api/payment
   ├─ amount: 2500 (cents)
   └─ userEmail: "user@example.com"

7. Backend creates Stripe PaymentIntent
   └─ Returns clientSecret

8. stripe.confirmCardPayment(clientSecret)
   ├─ Card: 4242 4242 4242 4242
   ├─ Email: "user@example.com"
   └─ Returns paymentIntent

9. If paymentIntent.status === "succeeded"
   ├─ saveOffsetRecords(userEmail, transactionId, cartItems)
   │  └→ Firestore creates offsets collection docs
   │     ├─ userEmail: "user@example.com"
   │     ├─ transactionId: "pi_xxxxx"
   │     ├─ stripePaymentIntentId: "pi_xxxxx"
   │     ├─ carbonKg, cost, description
   │     └─ status: "completed"
   │
   ├─ markCartItemsAsPurchased(cartItemIds)
   │  └→ Firestore updates cartItems: purchased = true
   │
   └─ clearCart()
      └→ Local cart emptied

10. Show success page
    └→ User sees confirmation
```

## Function Call Chain During Checkout

```
StripeCheckout.handleSubmit()
├─ getOrCreateUserByEmail(userEmail)
│  ├─ Query: users where email == userEmail
│  ├─ If not found: addDoc(users, { email, createdAt })
│  └─ Return: { id, email, createdAt, updatedAt }
│
├─ Backend: fetch("/api/payment", { amount, userEmail })
│  └─ Returns: { clientSecret, paymentIntentId }
│
├─ stripe.confirmCardPayment(clientSecret)
│  └─ Returns: { paymentIntent }
│
├─ saveOffsetRecords(userEmail, transactionId, cartItems)
│  ├─ For each cartItem:
│  │  └─ addDoc(offsets, {
│  │     userEmail,
│  │     transactionId,
│  │     stripePaymentIntentId,
│  │     carbonKg, cost, ...
│  │  })
│  └─ Return: [docId1, docId2, ...]
│
├─ markCartItemsAsPurchased(cartItemIds)
│  ├─ For each cartItemId:
│  │  └─ updateDoc(cartItems/docId, { purchased: true })
│  └─ Complete
│
└─ onSuccess({ id, status, amount, userEmail })
   └─ UI shows success
```

## Firestore Query Examples

### Get User's Offsets

```javascript
import { getUserOffsets } from "../utils/firestore";

const offsets = await getUserOffsets("user@example.com");
// Returns: [
//   { id: "doc1", userEmail: "user@example.com", carbonKg: 50, ... },
//   { id: "doc2", userEmail: "user@example.com", carbonKg: 100, ... }
// ]
```

### Get User's Cart

```javascript
import { getUserCartItems } from "../utils/firestore";

const cart = await getUserCartItems("user@example.com");
// Returns: [
//   { id: "cart1", userEmail: "user@example.com", purchased: false, ... }
// ]
```

### Get Transaction Details

```javascript
import { getTransactionOffsets } from "../utils/firestore";

const offsets = await getTransactionOffsets("pi_xxxxx");
// Returns all offsets for this Stripe payment
```

### Create or Get User

```javascript
import { getOrCreateUserByEmail } from "../utils/firestore";

const user = await getOrCreateUserByEmail("new@example.com");
// If exists: returns existing user
// If not: creates and returns new user
```

## Console Logging

The implementation logs important events:

```javascript
// Cart operations
"Cart item saved with ID: abc123def456";
"Cart item abc123def456 deleted from Firestore";
"Loaded 3 cart items from Firestore for user@example.com";

// Offset operations
"Successfully saved 3 offset records to Firestore";
"Marked 3 cart items as purchased";

// User operations
"Created new user with ID: xyz789";

// Errors
"Error saving cart item to Firestore: [error details]";
"Error loading cart from Firestore: [error details]";
```

To see these logs:

1. Open browser DevTools: `F12`
2. Go to Console tab
3. Complete an action (add to cart, checkout, etc.)
4. Look for messages starting with "Cart", "Offset", or "Error"

## Common Issues & Solutions

### Issue: Cart items not appearing after entering email

**Symptoms**:

- Add items to cart
- Enter email
- Cart appears empty

**Causes**:

- Firestore permission denied
- Network issue
- Email not being set in context

**Solution**:

```javascript
// Check in console:
// 1. Are items in localStorage?
console.log(JSON.parse(localStorage.getItem("cart")));

// 2. Can we query Firestore?
import { getUserCartItems } from "../utils/firestore";
const items = await getUserCartItems("test@example.com");
console.log(items);

// 3. Is userEmail being set?
// Add to Cart.jsx:
console.log("User email:", userEmail);
```

### Issue: Offsets not saving after payment succeeds

**Symptoms**:

- Payment completes successfully
- No offsets appear in Firestore
- No error in console

**Causes**:

- Firestore write permissions issue
- saveOffsetRecords() throwing silently
- userEmail not being passed

**Solution**:

```javascript
// Check payment response includes userEmail
// In StripeCheckout.jsx, add logging:
console.log("Payment succeeded:", {
  paymentIntentId: paymentIntent.id,
  userEmail: userEmail,
  cartItems: cartItems.length,
});

// Check Firestore security rules allow writes
// Query to verify offset records:
import { getTransactionOffsets } from "../utils/firestore";
const offsets = await getTransactionOffsets("pi_xxxxx");
console.log(offsets);
```

### Issue: User record not created

**Symptoms**:

- Offsets save but no user in users collection
- Can't query offsets by email

**Causes**:

- getOrCreateUserByEmail() not called
- Firestore write permissions for users collection

**Solution**:

```javascript
// Verify user was created:
import { getOrCreateUserByEmail } from "../utils/firestore";
const user = await getOrCreateUserByEmail("test@example.com");
console.log("User:", user);

// Should return:
// { id: "abc123", email: "test@example.com", createdAt, updatedAt }
```

## Firestore Security Rules (Recommended)

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Allow backend service account writes
    function isBackend() {
      return request.auth == null ||
             request.auth.uid == 'backend-service-account';
    }

    // Users collection
    match /users/{document=**} {
      allow read: if isBackend() ||
                     request.auth.token.email == resource.data.email;
      allow write: if isBackend();
    }

    // Cart items collection
    match /cartItems/{document=**} {
      allow read: if isBackend() ||
                     request.query.where('userEmail', '==', request.auth.token.email).exists();
      allow write: if isBackend();
    }

    // Offsets collection
    match /offsets/{document=**} {
      allow read: if isBackend() ||
                     request.query.where('userEmail', '==', request.auth.token.email).exists();
      allow write: if isBackend();
    }
  }
}
```

## Performance Monitoring

### Query Performance

```javascript
// Measure getUserOffsets timing
const start = performance.now();
const offsets = await getUserOffsets("user@example.com");
const duration = performance.now() - start;
console.log(`Query took ${duration.toFixed(2)}ms`);
```

### Expected Performance

- `saveCartItem()`: 100-500ms first time, 50-200ms after
- `getUserCartItems()`: 200-500ms depending on cart size
- `saveOffsetRecords()`: 500-1500ms for batch of 3-5 items
- `getOrCreateUserByEmail()`: 100-300ms

## Testing Checklist

- [ ] Console logs show successful operations
- [ ] Firestore collections have correct data
- [ ] Email-indexed queries return correct results
- [ ] Cart persists across page refreshes
- [ ] Cart syncs between tabs with same email
- [ ] Offsets linked to correct email
- [ ] Offsets linked to correct Stripe transaction
- [ ] Cart items marked as purchased after payment
- [ ] No errors in browser console

## References

- Firestore Console: https://console.firebase.google.com
- Stripe Dashboard: https://dashboard.stripe.com
- Firebase Documentation: https://firebase.google.com/docs
- Stripe Documentation: https://stripe.com/docs
