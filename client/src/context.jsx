import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, apiError } from "./api.js";

const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const [user, setUser] = useState(null);
  const [itemCount, setItemCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const notify = useCallback((message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  }, []);

  useEffect(() => {
    api.get("/auth/me")
      .then(({ data }) => {
        setUser(data.data.user);
        return api.get("/cart");
      })
      .then(({ data }) => {
        if (data?.data?.items) {
          setItemCount(data.data.items.reduce((total, item) => total + item.quantity, 0));
        }
      })
      .catch((error) => {
        if (error.response?.status !== 401) notify(apiError(error), "error");
      })
      .finally(() => setAuthLoading(false));
  }, [notify]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => ({
    user,
    setUser,
    itemCount,
    setItemCount,
    authLoading,
    notify,
  }), [user, itemCount, authLoading, notify]);

  return (
    <ShopContext.Provider value={value}>
      {children}
      {toast && (
        <div key={toast.id} role={toast.type === "error" ? "alert" : "status"} className={`toast toast--${toast.type}`}>
          {toast.message}
          <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) throw new Error("useShop must be used inside a ShopProvider.");
  return context;
}
