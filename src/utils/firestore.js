import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Save offset records to Firestore for each cart item
 * @param {string} userEmail - The email of the user
 * @param {string} transactionId - The Stripe payment intent ID
 * @param {Array} cartItems - Array of offset items from the cart
 * @returns {Promise<Array>} - Array of created document IDs
 */
export const saveOffsetRecords = async (userEmail, transactionId, cartItems) => {
  try {
    const db = getFirestore();
    const offsetsCollection = collection(db, "offsets");
    const docIds = [];

    // Save each cart item as a separate offset record
    for (const item of cartItems) {
      const offsetRecord = {
        userEmail,
        transactionId,
        offsetType: item.tripMode, // "car", "air", "home", or "quick"
        carbonPounds: item.co2 * 2.20462, // Convert kg to pounds
        carbonKg: item.co2, // Store original kg value as well
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

      const docRef = await addDoc(offsetsCollection, offsetRecord);
      docIds.push(docRef.id);
    }

    console.log(`Successfully saved ${docIds.length} offset records to Firestore`);
    return docIds;
  } catch (error) {
    console.error("Error saving offset records to Firestore:", error);
    throw error;
  }
};

/**
 * Generate a human-readable description for the offset
 * @param {Object} item - The cart item
 * @returns {string} - Description of the offset
 */
const getOffsetDescription = (item) => {
  switch (item.tripMode) {
    case "car":
      return `Car trip: ${item.origin} to ${item.destination} (${item.distance?.toFixed(2)} miles)`;
    case "air":
      return `Air travel: ${item.origin} to ${item.destination} (${item.distance?.toFixed(2)} miles)`;
    case "home":
      return `Home energy offset: ${item.co2?.toFixed(2)} kg CO2`;
    case "quick":
      return `Quick offset: ${item.co2?.toFixed(2)} kg CO2`;
    default:
      return `Offset: ${item.co2?.toFixed(2)} kg CO2`;
  }
};

/**
 * Retrieve all offset records for a specific user
 * @param {string} userEmail - The email of the user
 * @returns {Promise<Array>} - Array of offset records
 */
export const getUserOffsets = async (userEmail) => {
  try {
    const db = getFirestore();
    const offsetsCollection = collection(db, "offsets");
    const querySnapshot = await db
      .collection("offsets")
      .where("userEmail", "==", userEmail)
      .orderBy("timestamp", "desc")
      .get();

    const offsets = [];
    querySnapshot.forEach((doc) => {
      offsets.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return offsets;
  } catch (error) {
    console.error("Error retrieving offset records:", error);
    throw error;
  }
};

/**
 * Retrieve all offset records for a specific transaction
 * @param {string} transactionId - The transaction ID
 * @returns {Promise<Array>} - Array of offset records for the transaction
 */
export const getTransactionOffsets = async (transactionId) => {
  try {
    const db = getFirestore();
    const querySnapshot = await db
      .collection("offsets")
      .where("transactionId", "==", transactionId)
      .get();

    const offsets = [];
    querySnapshot.forEach((doc) => {
      offsets.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return offsets;
  } catch (error) {
    console.error("Error retrieving transaction offsets:", error);
    throw error;
  }
};
