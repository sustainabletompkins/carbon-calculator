import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  doc,
  deleteDoc,
  query,
  where,
  getDocs,
  updateDoc,
  limit,
} from "firebase/firestore";
import { API_URL } from "./apiUrl";

// Email is the identity key across carts, offsets, users and team lookups.
// Firestore matches strings exactly, so always compare and store one spelling.
export const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : email;

/**
 * Save a single cart item to Firestore
 * @param {string} userEmail - The email of the user
 * @param {Object} item - The cart item to save
 * @returns {Promise<string>} - The document ID
 */
export const saveCartItem = async (userEmail, item) => {
  userEmail = normalizeEmail(userEmail);
  try {
    const db = getFirestore();
    const cartCollection = collection(db, "cartItems");

    const cartItem = {
      userEmail,
      title: item.title || getOffsetDescription(item),
      cost: item.cost,
      co2: item.co2 || 0,
      tripMode: item.tripMode || null,
      type: item.type || "offset",
      origin: item.origin || null,
      destination: item.destination || null,
      distance: item.distance || null,
      travelers: item.travelers || 1,
      description:
        item.type === "donation"
          ? "Direct Donation"
          : getOffsetDescription(item),
      purchased: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(cartCollection, cartItem);
    console.log(`Cart item saved with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("Error saving cart item to Firestore:", error);
    throw error;
  }
};

/**
 * Delete a cart item from Firestore
 * @param {string} docId - The document ID of the cart item
 * @returns {Promise<void>}
 */
export const deleteCartItem = async (docId) => {
  try {
    const db = getFirestore();
    const cartItemRef = doc(db, "cartItems", docId);
    await deleteDoc(cartItemRef);
    console.log(`Cart item ${docId} deleted from Firestore`);
  } catch (error) {
    console.error("Error deleting cart item from Firestore:", error);
    throw error;
  }
};

/**
 * Get all cart items for a user
 * @param {string} userEmail - The email of the user
 * @returns {Promise<Array>} - Array of cart items
 */
export const getUserCartItems = async (userEmail) => {
  userEmail = normalizeEmail(userEmail);
  try {
    const db = getFirestore();
    const cartCollection = collection(db, "cartItems");
    const q = query(
      cartCollection,
      where("userEmail", "==", userEmail),
      where("purchased", "==", false)
    );
    const querySnapshot = await getDocs(q);

    const cartItems = [];
    querySnapshot.forEach((doc) => {
      cartItems.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return cartItems;
  } catch (error) {
    console.error("Error retrieving user cart items:", error);
    throw error;
  }
};

/**
 * Mark cart items as purchased
 * @param {Array<string>} cartItemIds - Array of cart item document IDs
 * @returns {Promise<void>}
 */
export const markCartItemsAsPurchased = async (cartItemIds) => {
  try {
    const db = getFirestore();

    for (const docId of cartItemIds) {
      const cartItemRef = doc(db, "cartItems", docId);
      await updateDoc(cartItemRef, {
        purchased: true,
        updatedAt: serverTimestamp(),
      });
    }

    console.log(`Marked ${cartItemIds.length} cart items as purchased`);
  } catch (error) {
    console.error("Error marking cart items as purchased:", error);
    throw error;
  }
};

/**
 * Save offset records to Firestore for each cart item
 * @param {string} userEmail - The email of the user
 * @param {string} transactionId - The Stripe payment intent ID
 * @param {Array} cartItems - Array of offset items from the cart
 * @returns {Promise<Array>} - Array of created document IDs
 */
export const saveOffsetRecords = async (
  userEmail,
  transactionId,
  cartItems
) => {
  userEmail = normalizeEmail(userEmail);
  try {
    const db = getFirestore();
    const offsetsCollection = collection(db, "offsets");
    const docIds = [];

    // Save each cart item as a separate offset record
    for (const item of cartItems) {
      const offsetRecord = {
        userEmail,
        transactionId,
        offsetType: item.tripMode || item.type, // "car", "air", "home", "quick", or "donation"
        carbonPounds: item.co2 ? item.co2 * 2.20462 : 0, // Convert kg to pounds
        carbonKg: item.co2 || 0, // Store original kg value as well
        cost: item.cost,
        description: getOffsetDescription(item),
        origin: item.origin || null,
        destination: item.destination || null,
        distance: item.distance || null,
        unit: item.distance ? "miles" : null,
        travelers: item.travelers || 1,
        stripePaymentIntentId: transactionId,
        status: "completed",
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(offsetsCollection, offsetRecord);
      docIds.push(docRef.id);
    }

    console.log(
      `Successfully saved ${docIds.length} offset records to Firestore`
    );
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
      return `Car trip: ${item.origin} to ${
        item.destination
      } (${item.distance?.toFixed(2)} miles)`;
    case "air":
      return `Air travel: ${item.origin} to ${
        item.destination
      } (${item.distance?.toFixed(2)} miles)`;
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
  userEmail = normalizeEmail(userEmail);
  try {
    const db = getFirestore();
    const offsetsCollection = collection(db, "offsets");
    const q = query(offsetsCollection, where("userEmail", "==", userEmail));
    const querySnapshot = await getDocs(q);

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
    const offsetsCollection = collection(db, "offsets");
    const q = query(
      offsetsCollection,
      where("transactionId", "==", transactionId)
    );
    const querySnapshot = await getDocs(q);

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

/**
 * Update offset records with Stripe payment information
 * @param {Array<string>} offsetIds - Array of offset document IDs
 * @param {string} stripePaymentIntentId - The Stripe payment intent ID
 * @returns {Promise<void>}
 */
export const updateOffsetsWithStripeData = async (
  offsetIds,
  stripePaymentIntentId
) => {
  try {
    const db = getFirestore();

    for (const docId of offsetIds) {
      const offsetRef = doc(db, "offsets", docId);
      await updateDoc(offsetRef, {
        stripePaymentIntentId,
        status: "completed",
        updatedAt: serverTimestamp(),
      });
    }

    console.log(`Updated ${offsetIds.length} offsets with Stripe data`);
  } catch (error) {
    console.error("Error updating offsets with Stripe data:", error);
    throw error;
  }
};

/**
 * Get or create a user record by email
 * @param {string} email - The user's email address
 * @param {Object} additionalData - Additional user data (name, zipCode, etc.)
 * @returns {Promise<Object>} - User data with email
 */
export const getOrCreateUserByEmail = async (email, additionalData = {}) => {
  email = normalizeEmail(email);
  try {
    const db = getFirestore();
    const usersCollection = collection(db, "users");
    const q = query(usersCollection, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // User exists
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      };
    } else {
      // Create new user
      const newUser = {
        email,
        ...additionalData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(usersCollection, newUser);
      console.log(`Created new user with ID: ${docRef.id}`);
      return {
        id: docRef.id,
        ...newUser,
      };
    }
  } catch (error) {
    console.error("Error getting or creating user by email:", error);
    throw error;
  }
};

/**
 * Look up an individual account in the teams collection by email.
 * Individual accounts are stored in the same `teams` collection with isIndividual: true.
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
export const getIndividualAccountByEmail = async (email) => {
  email = normalizeEmail(email);
  try {
    const db = getFirestore();
    const teamsCollection = collection(db, "teams");
    // Individual docs store the email field; group team docs don't — so querying
    // by email alone is safe and doesn't need a composite index.
    const q = query(teamsCollection, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    const individual = querySnapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .find((d) => d.isIndividual === true);

    return individual ?? null;
  } catch (error) {
    console.error("Error getting individual account by email:", error);
    throw error;
  }
};

/**
 * Look up all team memberships for a given email address
 * @param {string} email - The user's email address
 * @returns {Promise<Array>} - Array of {id, teamId, teamName, name, founder, ...}
 */
export const getTeamMembershipsByEmail = async (email) => {
  email = normalizeEmail(email);
  try {
    const db = getFirestore();
    const teamMembersCollection = collection(db, "teamMembers");
    const q = query(teamMembersCollection, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    const memberships = [];
    querySnapshot.forEach((docSnap) => {
      memberships.push({ id: docSnap.id, ...docSnap.data() });
    });

    return memberships;
  } catch (error) {
    console.error("Error getting team memberships by email:", error);
    throw error;
  }
};

/**
 * Resolve the teams document ID for a team's legacy numeric ID.
 * Memberships written by the migration carry `teamDocId` directly; ones added
 * through the admin UI only reference the team by `legacyId`, so they need
 * this lookup before a purchase can be attributed.
 * @param {number} legacyId - The team's legacyId
 * @returns {Promise<string|null>} - The teams document ID, or null if unknown
 */
export const getTeamDocIdByLegacyId = async (legacyId) => {
  if (legacyId === null || legacyId === undefined) return null;
  try {
    const db = getFirestore();
    const teamsCollection = collection(db, "teams");
    const q = query(
      teamsCollection,
      where("legacyId", "==", legacyId),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty ? null : querySnapshot.docs[0].id;
  } catch (error) {
    console.error("Error resolving team doc ID by legacy ID:", error);
    return null;
  }
};

/**
 * Attribute a completed purchase to a team or individual account.
 *
 * Offset records are admin-only for writes (firestore.rules), so this can't
 * be done from the browser — POST /api/attribute-offset performs the write
 * with admin credentials after verifying the payment with Stripe. It derives
 * the pounds and dollars from the stored offset records itself.
 *
 * @param {string} teamDocId - The teams document ID (teams and individuals share
 *   the collection and legacy numeric ids overlap, so the doc ID is the identity)
 * @param {string} paymentIntentId - The Stripe payment intent for the purchase
 * @returns {Promise<Object>} - { attributed, pounds, dollars }
 */
export const attributeOffsetToTeam = async (teamDocId, paymentIntentId) => {
  try {
    const response = await fetch(`${API_URL}/api/attribute-offset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamDocId, paymentIntentId }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Attribution failed (${response.status})`);
    }

    console.log(
      `Attributed ${data.pounds?.toFixed(0)} lbs / $${data.dollars?.toFixed(
        2
      )} to ${teamDocId}`
    );
    return data;
  } catch (error) {
    console.error("Error attributing offset to team:", error);
    throw error;
  }
};

/**
 * Update user profile with additional information
 * @param {string} email - The user's email address
 * @param {Object} userData - User data to update (name, zipCode, etc.)
 * @returns {Promise<void>}
 */
export const updateUserProfile = async (email, userData) => {
  email = normalizeEmail(email);
  try {
    const db = getFirestore();
    const usersCollection = collection(db, "users");
    const q = query(usersCollection, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      await updateDoc(doc.ref, {
        ...userData,
        updatedAt: serverTimestamp(),
      });
      console.log(`Updated user profile for ${email}`);
    }
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
};
