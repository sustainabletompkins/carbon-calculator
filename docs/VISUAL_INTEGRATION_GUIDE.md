# Visual Integration Guide

## Data Structure After Purchase

### Before Purchase

```
Local Storage (Client)
┌─────────────────────┐
│ cart: [             │
│   {                 │
│     title: "...",   │
│     cost: 25,       │
│     co2: 50         │
│   }                 │
│ ]                   │
└─────────────────────┘
```

### During Checkout

```
Browser Memory (Client)
┌──────────────────────────────┐
│ CartContext                  │
│ ├─ cart: [...]               │
│ ├─ userEmail: "user@..."     │  ← Set by user input
│ └─ loading: false            │
└──────────────────────────────┘
         ↓
Firestore Query
"cartItems where userEmail = 'user@...'"
         ↓
Firestore (Cloud)
┌────────────────────────────┐
│ cartItems collection       │
│ ├─ doc1                    │
│ │  ├─ userEmail: "user..." │
│ │  ├─ title: "Car Trip"    │
│ │  ├─ cost: 25             │
│ │  ├─ co2: 50              │
│ │  └─ purchased: false     │
│ └─ doc2, doc3, ...         │
└────────────────────────────┘
```

### After Successful Payment

```
Firestore (Cloud)
┌────────────────────────────────────────┐
│ users collection                       │
│ ├─ doc_xyz                             │
│ │  ├─ email: "user@example.com"        │
│ │  ├─ createdAt: 2024-11-23T...        │
│ │  └─ updatedAt: 2024-11-23T...        │
└────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│ cartItems collection                             │
│ ├─ doc1 (UPDATED)                                │
│ │  ├─ userEmail: "user@example.com"              │
│ │  ├─ purchased: true ← MARKED AS PURCHASED      │
│ │  └─ ...                                        │
└──────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────┐
│ offsets collection (NEW RECORDS)                       │
│ ├─ offset_1                                            │
│ │  ├─ userEmail: "user@example.com"  ← Links to user  │
│ │  ├─ transactionId: "pi_xxxxx"  ← Links to payment   │
│ │  ├─ stripePaymentIntentId: "pi_xxxxx"              │
│ │  ├─ carbonKg: 50                                    │
│ │  ├─ cost: 25                                        │
│ │  └─ status: "completed"                            │
│ │                                                     │
│ └─ offset_2, offset_3, ...                           │
└────────────────────────────────────────────────────────┘

Local Storage (Client)
┌─────────────────────┐
│ cart: [ ]           │  ← Cleared after checkout
└─────────────────────┘
```

## Email as User Identifier

```
Customer Email
     ↓
┌────────────────────┐
│ user@example.com   │
└────────────────────┘
     ↓
     ├─→ users/{docId}
     │   └─ email: "user@example.com" (indexed)
     │
     ├─→ cartItems/{docId1}, /{docId2}, ...
     │   ├─ userEmail: "user@example.com" (indexed)
     │   ├─ purchased: false (pending)
     │   └─ ...
     │
     └─→ offsets/{docId1}, /{docId2}, ...
         ├─ userEmail: "user@example.com" (indexed)
         ├─ stripePaymentIntentId: "pi_xxxxx" (indexed)
         └─ ...
```

## Query Patterns

```
User Wants: "Show me everything I bought with test@example.com"

Query 1: Get User Record
  db.collection('users')
    .where('email', '==', 'test@example.com')
  Returns: { id, email, createdAt }

Query 2: Get All Offsets
  db.collection('offsets')
    .where('userEmail', '==', 'test@example.com')
  Returns: [offset1, offset2, offset3, ...]

Query 3: Get Specific Transaction
  db.collection('offsets')
    .where('transactionId', '==', 'pi_xxxxx')
  Returns: [offset1, offset2, ...]

Query 4: Get Unpurchased Cart
  db.collection('cartItems')
    .where('userEmail', '==', 'test@example.com')
    .where('purchased', '==', false)
  Returns: [item1, item2, ...]
```

## Component State Flow

```
┌─────────────────────────────────────────────────────┐
│ APP                                                 │
└─────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────┐
│ CartProvider (wraps entire app)                     │
│ ┌───────────────────────────────────────────────┐   │
│ │ CartContext                                   │   │
│ │ ├─ cart: Item[]                               │   │
│ │ ├─ userEmail: string | null                   │   │
│ │ ├─ setUserEmail(email: string)                │   │
│ │ ├─ addToCart(item)                            │   │
│ │ ├─ removeFromCart(index)                      │   │
│ │ └─ clearCart()                                │   │
│ └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
            ↓
    ┌───────┴────────┐
    ↓                ↓
┌─────────────┐  ┌──────────────┐
│ Cart        │  │ Calculator   │
│ Component   │  │ Components   │
│             │  │              │
│ ├─ useContext│ │ ├─ useContext│
│ │  CartCtx  │ │ │  CartCtx   │
│ │           │ │ │            │
│ ├─ Displays │ │ ├─ Calculate │
│ │  items    │ │ │  offsets   │
│ │           │ │ │            │
│ ├─ Input    │ │ └─ Add to    │
│ │  email    │ │    cart      │
│ │           │ │              │
│ ├─ Button   │ └──────────────┘
│ │  Checkout │
│ │           │
│ └─────┬─────┘
└───────┼──────────────────────┐
        │                      │
        ↓                      ↓
   ┌─────────────────────────────────┐
   │ setUserEmail(email)             │
   │ (triggers Firestore sync)       │
   └─────────────────────────────────┘
        │
        ├─→ CartContext loads cart from Firestore
        │
        ↓
   ┌──────────────────────────┐
   │ StripeCheckout           │
   │                          │
   │ ├─ userEmail prop        │
   │ ├─ cartItems prop        │
   │ ├─ totalAmount prop      │
   │ │                        │
   │ └─ Opens payment modal   │
   │    ├─ Process payment    │
   │    ├─ Save offsets       │
   │    ├─ Mark items         │
   │    ├─ Clear cart         │
   │    └─ Show success       │
   └──────────────────────────┘
```

## State Transitions

```
INITIAL STATE
├─ cart: []
├─ userEmail: null
└─ localStorage: { cart: [] }

          ↓

USER ADDS ITEM
├─ cart: [item1]
├─ userEmail: null
├─ localStorage: { cart: [item1] }
└─ Firestore: ❌ (no email yet)

          ↓

USER ENTERS EMAIL
├─ cart: [item1] (OR synced from Firestore if any there)
├─ userEmail: "user@example.com"
├─ localStorage: { cart: [item1] }
└─ Firestore: ✅ cartItems queried
   └─ All items now linked to email

          ↓

USER ADDS ANOTHER ITEM
├─ cart: [item1, item2]
├─ userEmail: "user@example.com"
├─ localStorage: { cart: [item1, item2] }
└─ Firestore: ✅ item2 saved with userEmail

          ↓

USER REMOVES ITEM
├─ cart: [item1]
├─ userEmail: "user@example.com"
├─ localStorage: { cart: [item1] }
└─ Firestore: ✅ item2 deleted

          ↓

USER CLICKS CHECKOUT
├─ StripeCheckout opens
├─ Gets/creates user record
├─ Processes payment
├─ Saves offsets
└─ Marks items purchased

          ↓

PAYMENT SUCCESSFUL
├─ cart: []
├─ userEmail: "user@example.com"
├─ localStorage: { cart: [] }
└─ Firestore:
   ├─ users: 1 record with email
   ├─ offsets: 2 records with userEmail + transactionId
   └─ cartItems: 2 items with purchased: true
```

## Error Handling Flow

```
ADD TO CART
    ↓
Try saveCartItem()
    ├─ Success: Item saved to Firestore ✅
    │           Item added to cart ✅
    │
    └─ Error: Item added to cart ✅
             Error logged ⚠️
             (retry on next action)
```

```
PAYMENT FLOW
    ↓
Stripe payment ✅
    ↓
Try saveOffsetRecords() & markCartItemsAsPurchased()
    ├─ Success: Offsets saved ✅
    │           Items marked ✅
    │           Cart cleared ✅
    │
    └─ Error: Offsets NOT saved ❌
             Items NOT marked ❌
             Cart NOT cleared ❌

             BUT payment still succeeded ✅
             Show success to user ✅
             Log error for manual recovery ⚠️
```

## Firestore Rules of Thumb

```
When to Query by userEmail:
├─ Get all purchases: getUserOffsets(email)
├─ Get unpurchased cart: getUserCartItems(email)
├─ Load previous session: getUserCartItems(email) when email is set
└─ User account dashboard: getUserOffsets(email)

When to Query by transactionId:
├─ Get details of one purchase: getTransactionOffsets(paymentId)
├─ Stripe webhook processing: Check if offsets exist
├─ Reconciliation: Match Stripe records to Firestore
└─ Support: "Show me all items from this payment"

When to Create User:
├─ Before payment processing (ensures user exists)
├─ On first email entry (optional, for user tracking)
└─ Via getOrCreateUserByEmail() (automatic)
```

## Indexes Required

```
cartItems Collection Index:
┌────────────────────────────┐
│ Field1: userEmail (Asc)    │
│ Field2: purchased (Asc)    │
│ Status: ⏳ Create in console │
└────────────────────────────┘
Purpose: Fast queries for:
  - Cart items for user
  - Unpurchased items

offsets Collection Index:
┌────────────────────────────┐
│ Field1: userEmail (Asc)    │
│ Field2: timestamp (Desc)   │
│ Status: ⏳ Create in console │
└────────────────────────────┘
Purpose: Fast queries for:
  - User's purchase history (newest first)
  - Recent purchases

users Collection Index:
┌────────────────────────────┐
│ Field1: email (Asc)        │
│ Status: Automatic          │
└────────────────────────────┘
Purpose: Fast queries for:
  - User lookup by email
  - User creation check
```

## Deployment Checklist

```
BEFORE GOING TO PRODUCTION

Code Changes:
☐ All files updated (CartContext, Cart, StripeCheckout, firestore.js)
☐ No console.error references in core logic
☐ Error handling in place

Backend Integration:
☐ /api/payment endpoint accepts userEmail
☐ userEmail passed to Stripe metadata (optional)
☐ Payment logging includes userEmail

Firestore Setup:
☐ Collections created: users, cartItems, offsets
☐ Indexes created for queries
☐ Security rules implemented
☐ Backup configured

Testing:
☐ Add item to cart
☐ Enter email → verify sync
☐ Checkout → verify payment
☐ Verify records in Firestore
☐ Query by email → verify results
☐ Test error cases

Monitoring:
☐ Logging configured
☐ Error tracking enabled
☐ Firestore quota monitoring
☐ Stripe webhook handling
```
