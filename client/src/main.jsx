import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ShopProvider } from "./context.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ShopProvider>
      <App />
    </ShopProvider>
  </StrictMode>,
);
