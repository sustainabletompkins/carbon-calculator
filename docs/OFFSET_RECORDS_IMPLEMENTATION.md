# Carbon Offset Records Implementation - Quick Summary

## ✅ What's Been Implemented

You now have a complete system for storing carbon offset records to Firebase Cloud Firestore. Here's what was done:

### 1. **New Files Created**
- **`src/utils/firestore.js`** - Utility functions for Firestore operations
  - `saveOffsetRecords()` - Saves each cart item as a separate record
  - `getUserOffsets()` - Retrieve all offsets for a user
  - `getTransactionOffsets()` - Retrieve all offsets for a transaction

### 2. **Files Updated**

#### `src/firebase.js`
- Added Firestore initialization (`getFirestore`)
- Exports the Firestore database instance

#### `src/components/Cart.jsx`
- Added email input field (required before checkout)
- Email validation
- Passes `cart` items and `userEmail` to StripeCheckout

#### `src/components/StripeCheckout.jsx`
- Accepts `cartItems` and `userEmail` props
- After successful payment, calls `saveOffsetRecords()`
- Gracefully handles Firestore errors

## 📊 How Records Are Stored

Each offset item is saved as a separate document in Firestore with:
- **userEmail** - User's email (provided at checkout)
- **transactionId** - Stripe Payment Intent ID (same for all items in one transaction)
- **offsetType** - Type of offset ("car", "air", "home", "quick")
- **carbonPounds** - CO2 in pounds
- **carbonKg** - CO2 in kilograms
- **cost** - Dollar amount
- **description** - Human-readable description
- **origin/destination** - Travel route (if applicable)
- **distance** - Distance in miles (if applicable)
- **travelers** - Number of travelers
- **timestamp** - Server-generated timestamp

## 🎯 Key Features

✅ **Individual Tracking** - Each type of offset (air, car, home, quick) is tracked separately
✅ **Transaction Linking** - All items in a purchase share the same transaction ID
✅ **User Records** - Email identifies which user made the purchase
✅ **Flexible Queries** - Query by user email or transaction ID
✅ **Non-blocking** - Firestore errors don't interrupt the payment flow

## 📝 User Flow

1. User adds offsets to cart (air travel, car trips, home energy, etc.)
2. User clicks "Proceed to Checkout" 
3. **NEW**: User enters their email address
4. Payment modal opens
5. User completes payment with Stripe
6. **NEW**: Firestore automatically saves each cart item as a separate record
7. User sees thank you page
8. Records are now queryable in Firestore by user email or transaction ID

## 🔧 What You Need to Do

1. **Update Firebase Credentials** in `src/firebase.js`
   - Replace placeholder values with your actual Firebase project credentials

2. **Create Firestore Collection** (if not auto-created)
   - Collection name: `offsets`
   - Documents will be auto-created on first purchase

3. **Configure Security Rules** (recommended)
   - Set up Firestore security rules to protect user data
   - Allow users to read only their own records

4. **Test It**
   - Add items to cart
   - Proceed to checkout
   - Enter an email
   - Complete payment
   - Check Firestore console to verify records were saved

## 📚 Usage Examples

### Get all offsets for a user:
```javascript
import { getUserOffsets } from './utils/firestore';

const offsets = await getUserOffsets('user@example.com');
```

### Get all offsets from a transaction:
```javascript
import { getTransactionOffsets } from './utils/firestore';

const txOffsets = await getTransactionOffsets('pi_1234567890');
```

### Filter by offset type in Firestore console:
```
Collection: offsets
Filter: offsetType == "air"
```

## 🎨 UI Changes

- Email input field added to cart page (required field)
- Helper text explains the email is used for tracking records
- Error messages if email is missing or invalid

## 🚀 Next Steps

1. **Verify Firestore Connection** - Check that records are being saved
2. **Build User Dashboard** - Display user's offset history
3. **Add Reporting** - Generate reports by offset type, date range, etc.
4. **Email Notifications** - Send confirmation emails with offset details
5. **Data Export** - Allow users to export their offset records

## 📋 Database Schema Reference

```
firestore
  └── offsets (collection)
       └── doc_id_1
            ├── userEmail: "user@example.com"
            ├── transactionId: "pi_123..."
            ├── offsetType: "air"
            ├── carbonPounds: 1500.5
            ├── carbonKg: 680
            ├── cost: 68.00
            ├── description: "Air travel: NYC → LAX"
            ├── origin: "New York"
            ├── destination: "Los Angeles"
            ├── distance: 2451
            ├── travelers: 1
            └── timestamp: (server timestamp)
       
       └── doc_id_2
            ├── userEmail: "user@example.com"
            ├── transactionId: "pi_123..."
            ├── offsetType: "car"
            ├── carbonPounds: 442
            ├── carbonKg: 200.5
            ├── cost: 20.05
            └── ...
```

All items with the same `transactionId` were purchased in the same transaction.
You can now filter and track each type individually while maintaining the transaction relationship.
