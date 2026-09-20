import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Elements } from "@stripe/react-stripe-js";
import { stripePromise } from "./utils/stripeLoader.js";
import "./index.css";
import App from "./App.jsx";
import { CartProvider } from "./contexts/CartContext.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Elements stripe={stripePromise}>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </Elements>
  </StrictMode>
);
