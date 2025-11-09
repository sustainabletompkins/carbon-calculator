# Firestore Query Examples

This document shows how to query the offset records stored in Firestore.

## 1. Get All Offsets for a User

**JavaScript (Frontend):**
```javascript
import { getUserOffsets } from './utils/firestore';

const userOffsets = await getUserOffsets('user@example.com');
console.log(userOffsets);
// Returns array of all offset records for this user, sorted by newest first
```

**Firestore Query (Console):**
1. Go to Firestore > `offsets` collection
2. Add filter: `userEmail` `==` `user@example.com`
3. Click on "Order by" dropdown and select `timestamp` (descending)

## 2. Get All Offsets from a Specific Transaction

**JavaScript (Frontend):**
```javascript
import { getTransactionOffsets } from './utils/firestore';

const txOffsets = await getTransactionOffsets('pi_1ABC123DEF456');
console.log(txOffsets);
// Returns array of all items purchased in this transaction
```

**Firestore Query (Console):**
1. Go to Firestore > `offsets` collection
2. Add filter: `transactionId` `==` `pi_1ABC123DEF456`

## 3. Get All Air Travel Offsets for a User

**JavaScript (Frontend):**
```javascript
import { getUserOffsets } from './utils/firestore';

const airOffsets = await getUserOffsets('user@example.com');
const airOnly = airOffsets.filter(offset => offset.offsetType === 'air');
console.log(airOnly);
```

**Firestore Query (Console):**
1. Go to Firestore > `offsets` collection
2. Add filter: `userEmail` `==` `user@example.com`
3. Add filter: `offsetType` `==` `air`

## 4. Get All Home Energy Offsets for a User

**JavaScript (Frontend):**
```javascript
import { getUserOffsets } from './utils/firestore';

const homeOffsets = await getUserOffsets('user@example.com');
const homeOnly = homeOffsets.filter(offset => offset.offsetType === 'home');
console.log(homeOnly);
```

## 5. Calculate Total Carbon Offset by User

**JavaScript (Frontend):**
```javascript
import { getUserOffsets } from './utils/firestore';

const userOffsets = await getUserOffsets('user@example.com');
const totalCarbonKg = userOffsets.reduce((sum, offset) => sum + offset.carbonKg, 0);
const totalCarbonPounds = userOffsets.reduce((sum, offset) => sum + offset.carbonPounds, 0);
const totalSpent = userOffsets.reduce((sum, offset) => sum + offset.cost, 0);

console.log(`Total CO2 (kg): ${totalCarbonKg}`);
console.log(`Total CO2 (pounds): ${totalCarbonPounds}`);
console.log(`Total Spent: $${totalSpent.toFixed(2)}`);
```

## 6. Get All Car Trip Offsets

**JavaScript (Frontend):**
```javascript
import { getDb } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const db = getDb();
const q = query(collection(db, 'offsets'), where('offsetType', '==', 'car'));
const querySnapshot = await getDocs(q);
const carOffsets = [];
querySnapshot.forEach((doc) => {
  carOffsets.push({ id: doc.id, ...doc.data() });
});
console.log(carOffsets);
```

## 7. Get Offsets by Date Range

**JavaScript (Frontend):**
```javascript
import { getDb } from '../firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

const db = getDb();
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-12-31');

const q = query(
  collection(db, 'offsets'),
  where('userEmail', '==', 'user@example.com'),
  where('timestamp', '>=', startDate),
  where('timestamp', '<=', endDate),
  orderBy('timestamp', 'desc')
);

const querySnapshot = await getDocs(q);
const offsets = [];
querySnapshot.forEach((doc) => {
  offsets.push({ id: doc.id, ...doc.data() });
});
console.log(offsets);
```

## 8. Get Offsets Sorted by Cost (Highest to Lowest)

**JavaScript (Frontend):**
```javascript
import { getDb } from '../firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

const db = getDb();
const q = query(
  collection(db, 'offsets'),
  where('userEmail', '==', 'user@example.com'),
  orderBy('cost', 'desc')
);

const querySnapshot = await getDocs(q);
const offsets = [];
querySnapshot.forEach((doc) => {
  offsets.push({ id: doc.id, ...doc.data() });
});
console.log(offsets);
```

## 9. Get All Quick Offsets

**JavaScript (Frontend):**
```javascript
import { getDb } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const db = getDb();
const q = query(collection(db, 'offsets'), where('offsetType', '==', 'quick'));
const querySnapshot = await getDocs(q);
const quickOffsets = [];
querySnapshot.forEach((doc) => {
  quickOffsets.push({ id: doc.id, ...doc.data() });
});
console.log(quickOffsets);
```

## 10. Real-time Listener for User Offsets

**JavaScript (Frontend):**
```javascript
import { getDb } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const db = getDb();
const q = query(collection(db, 'offsets'), where('userEmail', '==', 'user@example.com'));

const unsubscribe = onSnapshot(q, (querySnapshot) => {
  const offsets = [];
  querySnapshot.forEach((doc) => {
    offsets.push({ id: doc.id, ...doc.data() });
  });
  console.log('Current offsets:', offsets);
});

// Stop listening when component unmounts
// unsubscribe();
```

## Advanced Queries

### Get Summary Statistics by Offset Type

```javascript
import { getUserOffsets } from './utils/firestore';

const userOffsets = await getUserOffsets('user@example.com');

const stats = {
  air: { count: 0, totalCo2Kg: 0, totalCost: 0 },
  car: { count: 0, totalCo2Kg: 0, totalCost: 0 },
  home: { count: 0, totalCo2Kg: 0, totalCost: 0 },
  quick: { count: 0, totalCo2Kg: 0, totalCost: 0 },
};

userOffsets.forEach(offset => {
  const type = offset.offsetType;
  stats[type].count++;
  stats[type].totalCo2Kg += offset.carbonKg;
  stats[type].totalCost += offset.cost;
});

console.log(stats);
```

### Find Largest Offset by CO2

```javascript
import { getUserOffsets } from './utils/firestore';

const userOffsets = await getUserOffsets('user@example.com');
const largest = userOffsets.reduce((max, offset) => 
  offset.carbonKg > max.carbonKg ? offset : max
);

console.log(`Largest offset: ${largest.description} - ${largest.carbonKg} kg CO2`);
```

### Filter by Distance (e.g., flights over 1000 miles)

```javascript
import { getUserOffsets } from './utils/firestore';

const userOffsets = await getUserOffsets('user@example.com');
const longFlights = userOffsets.filter(offset => 
  offset.offsetType === 'air' && offset.distance > 1000
);

console.log(`Long flights (>1000 miles): ${longFlights.length}`);
```

## Firestore Console Tips

1. **View All Documents**
   - Go to Firestore > offsets collection
   - All documents are displayed

2. **Add Filters**
   - Click "+ Add filter"
   - Select field, operator, value
   - Can add multiple filters

3. **Order Results**
   - Click "Order by"
   - Select field and ascending/descending

4. **Export Data**
   - Click "..." next to collection name
   - Select "Export collection" to download as JSON

5. **Delete Records**
   - Click on a document
   - Click "Delete"
   - Note: Use caution in production!

## Performance Tips

- Use specific queries (with `userEmail` filter) rather than querying all offsets
- Composite indexes may be needed for complex queries (Firestore will suggest them)
- Consider denormalizing data if queries become too complex
- Use pagination for large result sets (limit + offset)

## Example: Pagination

```javascript
import { getDb } from '../firebase';
import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';

const db = getDb();
let lastVisible = null;
const PAGE_SIZE = 10;

async function getOffsetPage(pageNum = 1) {
  let q;
  
  if (pageNum === 1) {
    q = query(
      collection(db, 'offsets'),
      where('userEmail', '==', 'user@example.com'),
      orderBy('timestamp', 'desc'),
      limit(PAGE_SIZE)
    );
  } else {
    q = query(
      collection(db, 'offsets'),
      where('userEmail', '==', 'user@example.com'),
      orderBy('timestamp', 'desc'),
      startAfter(lastVisible),
      limit(PAGE_SIZE)
    );
  }
  
  const querySnapshot = await getDocs(q);
  const offsets = [];
  querySnapshot.forEach((doc) => {
    offsets.push({ id: doc.id, ...doc.data() });
  });
  
  lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
  return offsets;
}

const page1 = await getOffsetPage(1);
const page2 = await getOffsetPage(2);
```

These examples should cover most of your querying needs. Adapt them based on your specific requirements!
