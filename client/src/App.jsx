import { lazy, Suspense, useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import StoreLayout from "./components/Layout.jsx";
import { useShop } from "./context.jsx";

const HomePage = lazy(() => import("./pages/Storefront.jsx").then((page) => ({ default: page.HomePage })));
const ShopPage = lazy(() => import("./pages/Storefront.jsx").then((page) => ({ default: page.ShopPage })));
const ProductPage = lazy(() => import("./pages/Storefront.jsx").then((page) => ({ default: page.ProductPage })));
const ContactPage = lazy(() => import("./pages/Storefront.jsx").then((page) => ({ default: page.ContactPage })));
const EditorialPage = lazy(() => import("./pages/Storefront.jsx").then((page) => ({ default: page.EditorialPage })));
const NotFoundPage = lazy(() => import("./pages/Storefront.jsx").then((page) => ({ default: page.NotFoundPage })));
const AccountPage = lazy(() => import("./pages/Account.jsx").then((page) => ({ default: page.AccountPage })));
const CartPage = lazy(() => import("./pages/Account.jsx").then((page) => ({ default: page.CartPage })));
const CheckoutPage = lazy(() => import("./pages/Account.jsx").then((page) => ({ default: page.CheckoutPage })));
const OrdersPage = lazy(() => import("./pages/Account.jsx").then((page) => ({ default: page.OrdersPage })));
const WishlistPage = lazy(() => import("./pages/Account.jsx").then((page) => ({ default: page.WishlistPage })));
const LoginPage = lazy(() => import("./pages/Account.jsx").then((page) => ({ default: page.LoginPage })));
const ForgotPasswordPage = lazy(() => import("./pages/Account.jsx").then((page) => ({ default: page.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./pages/Account.jsx").then((page) => ({ default: page.ResetPasswordPage })));
const AdminPage = lazy(() => import("./pages/Admin.jsx"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);
  return null;
}

function RequireAccount({ admin = false }) {
  const { user, authLoading } = useShop();
  const location = useLocation();
  if (authLoading) return <div className="loading-page"><span className="spinner" />One little moment…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (admin && user.role !== "admin") return <Navigate to="/account" replace />;
  if (!admin && user.role === "admin") return <Navigate to="/admin" replace />;
  return <Outlet />;
}

function StandaloneLayout() {
  return (
    <>
      <Link to="/" className="standalone-wordmark wordmark">atelier<span>.</span></Link>
      <Outlet />
    </>
  );
}

function PageLoader() {
  return <div className="loading-page"><span className="spinner" />One little moment…</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<StoreLayout />}>
              <Route index element={<HomePage />} />
              <Route path="shop" element={<ShopPage />} />
              <Route path="category/:slug" element={<ShopPage />} />
              <Route path="product/:slug" element={<ProductPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="about" element={<EditorialPage page="about" />} />
              <Route path="faq" element={<EditorialPage page="faq" />} />
              <Route path="privacy" element={<EditorialPage page="privacy" />} />
              <Route path="terms" element={<EditorialPage page="terms" />} />
              <Route path="shipping" element={<EditorialPage page="shipping" />} />
              <Route element={<RequireAccount />}>
                <Route path="account" element={<AccountPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="orders/:orderId" element={<OrdersPage detail />} />
                <Route path="wishlist" element={<WishlistPage />} />
                <Route path="checkout" element={<CheckoutPage />} />
              </Route>
            </Route>
            <Route element={<StandaloneLayout />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<LoginPage register />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
              <Route path="reset-password/:token" element={<ResetPasswordPage />} />
            </Route>
            <Route path="admin/*" element={<RequireAccount admin />}><Route path="*" element={<AdminPage />} /></Route>
            <Route path="*" element={<StoreLayout />}>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </MotionConfig>
    </BrowserRouter>
  );
}
