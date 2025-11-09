# Testing & Troubleshooting Firestore Integration

## ✅ Testing Checklist

### Pre-Checkout Testing
- [ ] Add multiple items to cart (different types: air, car, home, quick)
- [ ] Verify cart display shows all items correctly
- [ ] Verify cart totals (CO2 and cost) are calculated correctly

### Checkout Testing
- [ ] Click "Proceed to Checkout" without entering email → Error message appears
- [ ] Enter invalid email (e.g., "notanemail") → Error message appears
- [ ] Enter valid email → Checkout modal opens
- [ ] Try payment with test Stripe card

### Payment Testing
Use [Stripe Test Cards](https://stripe.com/docs/testing#cards):

**Success Test:**
- Card Number: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., `12/25`)
- CVC: Any 3 digits (e.g., `123`)

**Decline Test:**
- Card Number: `4000 0000 0000 0002`
- Will show error

**Authentication Test:**
- Card Number: `4000 0025 0000 3155`
- Requires authentication

### Post-Payment Testing
- [ ] Payment completes successfully
- [ ] Thank you page appears
- [ ] Cart is cleared
- [ ] Browser console shows "Offset records saved to Firestore successfully"

### Firestore Testing
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Firestore Database
4. Look for `offsets` collection
5. Verify documents were created with correct data:

```
Expected document structure:
- userEmail: (the email you entered)
- transactionId: (starts with "pi_")
- offsetType: "air", "car", "home", or "quick"
- carbonKg: (number)
- carbonPounds: (number, should be ~2.2x carbonKg)
- cost: (number)
- description: (text description)
- origin: (for trips)
- destination: (for trips)
- distance: (for trips)
- travelers: (usually 1)
- timestamp: (should be recent)
- createdAt: (ISO timestamp)
```

## 🔍 Troubleshooting

### Issue: "Firestore has not loaded" or `getFirestore is not defined`

**Solution:**
1. Check `src/firebase.js` has `import { getFirestore } from "firebase/firestore"`
2. Verify Firebase credentials are correctly set in `firebaseConfig`
3. Check browser console for Firebase initialization errors

### Issue: Records not appearing in Firestore

**Debugging Steps:**

1. **Check browser console for errors:**
   ```
   Open DevTools → Console tab
   Look for error messages during payment
   ```

2. **Enable Firestore logging:**
   ```javascript
   import { enableLogging } from "firebase/firestore";
   enableLogging(true); // Add to firebase.js
   ```

3. **Verify Firebase credentials:**
   - Go to Firebase Console
   - Project Settings
   - Service accounts
   - Copy credentials again to `src/firebase.js`

4. **Check Firestore rules:**
   - Go to Firebase > Firestore > Rules
   - Verify write permissions are enabled (at least for testing)
   - Test rule: 
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /offsets/{document=**} {
         allow read, write: if true; // ONLY FOR TESTING
       }
     }
   }
   ```

5. **Check network requests:**
   - Open DevTools → Network tab
   - Look for POST requests to Firestore
   - Should see HTTP 200 responses

### Issue: Email validation rejecting valid emails

**Solution:**
The validation regex is: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`

This should work for standard emails. If it's rejecting a valid email:
1. Check the email in browser console: `console.log(email)`
2. Adjust regex if needed in `Cart.jsx` in `validateEmail()`

### Issue: Payment succeeds but records don't save

**Possible Causes:**

1. **Firebase not initialized:**
   ```javascript
   // In firestore.js, verify this works:
   import { getFirestore } from "firebase/firestore";
   const db = getFirestore();
   ```

2. **cartItems or userEmail is empty:**
   - Add debugging in `StripeCheckout.jsx`:
   ```javascript
   console.log("cartItems:", cartItems);
   console.log("userEmail:", userEmail);
   ```

3. **Firestore collection doesn't exist:**
   - First record creation automatically creates the collection
   - If it fails, check Firestore security rules

4. **Network error:**
   - Check internet connection
   - Verify CORS settings (usually not an issue with Firestore)

### Issue: Test Firestore security rules blocking writes

**Temporary Fix (Testing Only):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Permanent Fix (Production):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /offsets/{document=**} {
      allow read: if request.auth.token.email == resource.data.userEmail;
      allow write: if request.auth != null;
    }
  }
}
```

## 📊 Data Verification

### Query to check if records were saved:

**In Firebase Console:**
1. Firestore > offsets collection
2. Add filter: `userEmail` `==` `[your test email]`
3. Should see documents with your test data

### Expected data points:

For Air Travel:
```
offsetType: "air"
carbonKg: 680 (example)
carbonPounds: 1500.5 (example, ~2.2x carbonKg)
description: "Air travel: [origin] → [destination]"
distance: [miles]
travelers: 1
```

For Car Trip:
```
offsetType: "car"
carbonKg: 200 (example)
carbonPounds: 440 (example)
description: "Car trip: [origin] to [destination]"
distance: [miles]
```

For Home Energy:
```
offsetType: "home"
carbonKg: 100 (example)
carbonPounds: 220 (example)
description: "Home energy offset: 100 kg CO2"
distance: null
```

## 🧪 Unit Test Template

```javascript
// Example test for Firestore integration
import { saveOffsetRecords } from '../utils/firestore';

describe('saveOffsetRecords', () => {
  it('should save individual offset records to Firestore', async () => {
    const mockCart = [
      {
        tripMode: 'air',
        co2: 680,
        cost: 68,
        origin: 'NYC',
        destination: 'LAX',
        distance: 2451,
        travelers: 1
      },
      {
        tripMode: 'car',
        co2: 200,
        cost: 20,
        origin: 'Boston',
        destination: 'New York',
        distance: 215
      }
    ];

    const result = await saveOffsetRecords(
      'test@example.com',
      'pi_test123',
      mockCart
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toBeDefined();
    expect(result[1]).toBeDefined();
  });
});
```

## 🚀 Performance Monitoring

### Check Firestore usage:
1. Firebase Console → Firestore
2. Click "Usage" tab
3. Monitor:
   - Number of read operations
   - Number of write operations
   - Storage used
   - Network bandwidth

### Optimize queries:
- Use indexed queries for complex filters
- Limit result sets with `.limit()`
- Use pagination for large datasets

## 📱 Testing on Different Devices

### Mobile Testing:
1. Use Chrome DevTools device emulation
2. Test email input on small screens
3. Verify touch interactions work

### Browser Testing:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

## 🔐 Security Testing

### Test Firestore rules:
1. Create test rules that block unauthorized access
2. Verify unauthenticated requests fail
3. Verify authenticated requests succeed (if email matches)

### Data privacy:
- [ ] Sensitive data is not logged
- [ ] Emails are not exposed in client-side code
- [ ] Transaction IDs are kept private

## 📝 Debugging Logs

Add this to `src/utils/firestore.js` for more debugging:

```javascript
export const saveOffsetRecords = async (userEmail, transactionId, cartItems) => {
  try {
    console.log('🔹 Starting to save offset records');
    console.log('📧 User Email:', userEmail);
    console.log('💳 Transaction ID:', transactionId);
    console.log('📦 Cart Items:', cartItems);
    
    const db = getFirestore();
    const offsetsCollection = collection(db, "offsets");
    const docIds = [];

    for (const item of cartItems) {
      console.log('📝 Processing item:', item);
      const offsetRecord = {
        userEmail,
        transactionId,
        offsetType: item.tripMode,
        carbonPounds: item.co2 * 2.20462,
        carbonKg: item.co2,
        cost: item.cost,
        description: getOffsetDescription(item),
        origin: item.origin || null,
        destination: item.destination || null,
        distance: item.distance || null,
        unit: item.distance ? "miles" : null,
        travelers: item.travelers || 1,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      };

      console.log('💾 Saving record:', offsetRecord);
      const docRef = await addDoc(offsetsCollection, offsetRecord);
      console.log('✅ Record saved with ID:', docRef.id);
      docIds.push(docRef.id);
    }

    console.log('🎉 Successfully saved', docIds.length, 'offset records');
    return docIds;
  } catch (error) {
    console.error('❌ Error saving offset records:', error);
    throw error;
  }
};
```

## ✨ Success Indicators

Your implementation is working correctly when:

✅ Email input appears before checkout
✅ Email validation works correctly
✅ Payment completes successfully
✅ Browser console shows "Offset records saved to Firestore successfully"
✅ Documents appear in Firestore collection
✅ Each cart item is a separate document
✅ All items in a transaction share the same `transactionId`
✅ Can query records by user email
✅ Can query records by transaction ID
✅ Can filter records by `offsetType`

Congratulations! Your Firestore integration is complete! 🎉
