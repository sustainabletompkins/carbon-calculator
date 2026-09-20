import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";

const AuthContext = createContext(null);

/**
 * Tracks the signed-in Firebase user and whether they carry the `admin`
 * custom claim. The claim is set server-side via `npm run admin:grant`
 * and lives in the ID token, so no Firestore read is needed here.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          // Force refresh so a freshly granted claim shows up without re-login.
          const tokenResult = await firebaseUser.getIdTokenResult(true);
          setIsAdmin(tokenResult.claims.admin === true);
        } catch (err) {
          console.error("Failed to read auth claims:", err);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(() => signInWithPopup(auth, googleProvider), []);
  const signOut = useCallback(() => firebaseSignOut(auth), []);

  /** Fresh ID token for calling admin endpoints on the Express server. */
  const getToken = useCallback(
    () => (auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null)),
    []
  );

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, signIn, signOut, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
