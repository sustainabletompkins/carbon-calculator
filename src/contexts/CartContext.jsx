import React, { createContext, useState, useEffect, useCallback } from "react";
import {
  saveCartItem,
  deleteCartItem,
  getUserCartItems,
} from "../utils/firestore";

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [userEmail, setUserEmail] = useState(null);
  const [loading, setLoading] = useState(false);

  // Initialize cart from localStorage or Firestore
  useEffect(() => {
    const storedCart = localStorage.getItem("cart");
    if (storedCart) {
      setCart(JSON.parse(storedCart));
    }
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  // Load user's cart from Firestore when email is set
  useEffect(() => {
    if (userEmail) {
      loadCartFromFirestore(userEmail);
    }
  }, [userEmail]);

  const loadCartFromFirestore = useCallback(async (email) => {
    try {
      setLoading(true);
      const firestoreCartItems = await getUserCartItems(email);

      const firestoreCart = firestoreCartItems.map((item) => ({
        ...item,
        co2: item.co2 || 0,
      }));

      // Merge: keep any local items that aren't already in Firestore,
      // and sync them up so Firestore stays the source of truth going forward.
      setCart((prevCart) => {
        const localOnlyItems = prevCart.filter((localItem) => !localItem.id);

        // Fire-and-forget: save unsynced local items to Firestore
        localOnlyItems.forEach(async (item) => {
          try {
            const docId = await saveCartItem(email, item);
            item.id = docId;
            item.firestoreId = docId;
          } catch (e) {
            console.error("Error syncing local cart item to Firestore:", e);
          }
        });

        const merged = [...firestoreCart, ...localOnlyItems];
        console.log(
          `Loaded ${firestoreCart.length} Firestore + ${localOnlyItems.length} local items for ${email}`
        );
        return merged;
      });
    } catch (error) {
      console.error("Error loading cart from Firestore:", error);
      // Leave existing cart intact if Firestore fails
    } finally {
      setLoading(false);
    }
  }, []);

  const addToCart = useCallback(
    async (item) => {
      try {
        const newItem = { ...item };

        // If user email is set, save to Firestore
        if (userEmail) {
          const docId = await saveCartItem(userEmail, newItem);
          newItem.id = docId;
          newItem.firestoreId = docId;
        }

        setCart((prevCart) => [...prevCart, newItem]);
      } catch (error) {
        console.error("Error adding item to cart:", error);
        // Still add to local cart even if Firestore fails
        setCart((prevCart) => [...prevCart, item]);
      }
    },
    [userEmail]
  );

  const removeFromCart = useCallback(
    async (index) => {
      try {
        const itemToRemove = cart[index];

        // If item has Firestore ID, delete from Firestore
        if (itemToRemove?.id) {
          await deleteCartItem(itemToRemove.id);
        }

        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
      } catch (error) {
        console.error("Error removing item from cart:", error);
        // Still remove from local cart even if Firestore fails
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
      }
    },
    [cart]
  );

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const setUserEmailContext = useCallback((email) => {
    setUserEmail(email);
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        userEmail,
        setUserEmail: setUserEmailContext,
        loading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
