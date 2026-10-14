import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { ArrowLeft, ArrowRight, Check, Clock3, Package, ShieldCheck, Trash2, Truck } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, apiError, money } from "../api.js";
import { useShop } from "../context.jsx";
import { formatVariant } from "../variant.js";

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
const passwordSchema = z.string()
  .min(10, "Use at least 10 characters.")
  .max(128)
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/\d/, "Add a number.");
const registerSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(100),
  email: z.email("Enter a valid email address."),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(({ password, confirmPassword }) => password === confirmPassword, {
  message: "The passwords don't match.",
  path: ["confirmPassword"],
});
const addressSchema = z.object({
  label: z.string().trim().max(40).default("Home"),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?[0-9\s()-]{8,20}$/, "Enter a phone number we can reach."),
  line1: z.string().trim().min(3).max(180),
  line2: z.string().trim().max(180).default(""),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().min(3).max(16),
  country: z.string().trim().min(2).max(100).default("India"),
});

function FormMessage({ errors, name }) {
  return errors[name] ? <span className="field-error">{errors[name].message}</span> : null;
}

function AuthFrame({ children, eyebrow, title, description }) {
  return (
    <section className="auth-page">
      <div className="auth-editorial"><Link to="/" className="wordmark">atelier<span>.</span></Link><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p><Link className="text-link" to="/shop">Get to know the collection <ArrowRight size={15} /></Link></div>
      <div className="auth-form-wrap">{children}</div>
    </section>
  );
}

export function LoginPage({ register = false }) {
  const { setUser, notify } = useShop();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const { register: registerField, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(register ? registerSchema : loginSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  async function submit(values) {
    setBusy(true);
    try {
      const endpoint = register ? "/auth/register" : "/auth/login";
      const { data } = await api.post(endpoint, {
        ...(register && { name: values.name }),
        email: values.email,
        password: values.password,
      });
      setUser(data.data.user);
      notify(register ? "A warm welcome. Your account is ready." : "Good to have you back.");
      navigate(location.state?.from?.pathname ?? (data.data.user.role === "admin" ? "/admin" : "/account"), { replace: true });
    } catch (error) {
      notify(apiError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      eyebrow={register ? "A good place to begin" : "Come on back"}
      title={register ? <>Make a little<br /><em>room for good.</em></> : <>Good things<br /><em>are waiting.</em></>}
      description={register ? "Create an account to keep the good things together: saved addresses, thoughtful finds and the story of your orders." : "Sign in to pick up right where you left off, find your bag or check on an order."}
    >
      <form className="form-card auth-form" onSubmit={handleSubmit(submit)} noValidate>
        <div><span className="eyebrow">{register ? "Set up your account" : "Your account"}</span><h2>{register ? "A few details." : "Sign in."}</h2></div>
        {register && <label>Your name<input autoComplete="name" {...registerField("name")} aria-invalid={Boolean(errors.name)} /><FormMessage errors={errors} name="name" /></label>}
        <label>Email address<input type="email" autoComplete="email" {...registerField("email")} aria-invalid={Boolean(errors.email)} /><FormMessage errors={errors} name="email" /></label>
        <label>Password<input type="password" autoComplete={register ? "new-password" : "current-password"} {...registerField("password")} aria-invalid={Boolean(errors.password)} /><FormMessage errors={errors} name="password" />{register && !errors.password && <span className="field-hint">10+ characters, an uppercase letter, a lowercase letter and a number.</span>}</label>
        {register && <label>Confirm password<input type="password" autoComplete="new-password" {...registerField("confirmPassword")} aria-invalid={Boolean(errors.confirmPassword)} /><FormMessage errors={errors} name="confirmPassword" /></label>}
        {!register && <Link className="forgot-link" to="/forgot-password">Forgot your password?</Link>}
        <button className="button button--dark auth-submit" type="submit" disabled={busy}>{busy ? "One moment…" : register ? "Create your account" : "Come on in"} <ArrowRight size={15} /></button>
        <p className="auth-switch">{register ? "Already have an account?" : "New around here?"} <Link to={register ? "/login" : "/register"}>{register ? "Sign in" : "Create an account"}</Link></p>
      </form>
    </AuthFrame>
  );
}

export function ForgotPasswordPage() {
  const { notify } = useShop();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      notify(data.data.message);
      setSent(true);
    } catch (error) {
      notify(apiError(error), "error");
    } finally {
      setBusy(false);
    }
  }
  return <AuthFrame eyebrow="It happens to the best of us" title={<>Let's get you<br /><em>back in.</em></>} description="Leave your email and, if there is an account for it, we'll send you a secure, one-time link."><form className="form-card auth-form" onSubmit={submit}><span className="eyebrow">Password reset</span><h2>{sent ? "Check your inbox." : "Your email address."}</h2><p>{sent ? "If we found an account, a reset link is on its way. It expires in 30 minutes." : "We'll send a one-time reset link, valid for 30 minutes."}</p>{!sent && <><label>Email address<input type="email" autoComplete="email" required maxLength="254" value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="button button--dark auth-submit" disabled={busy}>{busy ? "Sending…" : "Send me a reset link"} <ArrowRight size={15} /></button></>}<Link className="text-link" to="/login"><ArrowLeft size={15} /> Back to sign in</Link></form></AuthFrame>;
}

export function ResetPasswordPage() {
  const { token } = useParams();
  const { notify } = useShop();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const result = passwordSchema.safeParse(password);
    if (!result.success) return notify(result.error.issues[0].message, "error");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/reset-password", { token, password });
      notify(data.data.message);
      navigate("/login", { replace: true });
    } catch (error) {
      notify(apiError(error), "error");
    } finally {
      setBusy(false);
    }
  }
  return <AuthFrame eyebrow="A fresh start" title={<>A new password.<br /><em>A fresh page.</em></>} description="Choose a strong password you'll remember. Your reset link works only once."><form className="form-card auth-form" onSubmit={submit}><span className="eyebrow">Set a new password</span><label>New password<input type="password" autoComplete="new-password" minLength="10" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><span className="field-hint">10+ characters, an uppercase letter, a lowercase letter and a number.</span><button className="button button--dark auth-submit" disabled={busy}>{busy ? "Updating…" : "Update your password"} <ArrowRight size={15} /></button></form></AuthFrame>;
}

const emptyAddress = { label: "Home", fullName: "", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "India" };

export function CartPage() {
  const { itemCount, setItemCount, notify } = useShop();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function loadCart() {
    const { data } = await api.get("/cart");
    setCart(data.data);
    setItemCount(data.data.items.reduce((total, item) => total + item.quantity, 0));
    setCouponCode(data.data.couponCode ?? "");
  }
  useEffect(() => {
    loadCart().catch((requestError) => setError(apiError(requestError))).finally(() => setLoading(false));
  }, []);

  async function changeQuantity(productId, variant, quantity) {
    const key = `${productId}-${variant}`;
    setBusy(key);
    try {
      await api.patch(`/cart/items/${productId}`, { variant, quantity });
      await loadCart();
    } catch (requestError) {
      notify(apiError(requestError), "error");
    } finally {
      setBusy("");
    }
  }
  async function removeItem(productId, variant) {
    const key = `${productId}-${variant}`;
    setBusy(key);
    try {
      await api.delete(`/cart/items/${productId}`, { params: { variant } });
      await loadCart();
      notify("Taken out of your bag.");
    } catch (requestError) {
      notify(apiError(requestError), "error");
    } finally {
      setBusy("");
    }
  }
  async function applyCoupon(event) {
    event.preventDefault();
    try {
      const { data } = await api.put("/cart/coupon", { code: couponCode });
      notify(data.data.message);
      await loadCart();
    } catch (requestError) {
      notify(apiError(requestError), "error");
    }
  }
  async function removeCoupon() {
    try {
      await api.delete("/cart/coupon");
      await loadCart();
      notify("Coupon removed.");
    } catch (requestError) {
      notify(apiError(requestError), "error");
    }
  }

  if (loading) return <div className="loading-page"><span className="spinner" />Taking a look in your bag…</div>;
  if (error) return <div className="empty-state empty-state--page"><h1>We couldn't load your bag.</h1><p>{error}</p><button type="button" className="button button--outline" onClick={() => loadCart().catch((requestError) => notify(apiError(requestError), "error"))}>Try again</button></div>;
  if (!cart?.items.length) return <section className="empty-state empty-state--page"><span className="empty-state__mark">a.</span><span className="eyebrow">There’s room for something good</span><h1>Your bag feels a little light.</h1><p>The pieces that feel most like home are just around the corner.</p><Link className="button button--dark" to="/shop">Find a favourite <ArrowRight size={15} /></Link></section>;

  const subtotal = cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  return <section className="cart-page section-wrap"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><span>Your bag</span></div><div className="cart-heading"><div><span className="eyebrow">Thoughtful choices, coming right up</span><h1>Your bag<span> · {itemCount} {itemCount === 1 ? "piece" : "pieces"}</span></h1></div><Link to="/shop" className="text-link desktop-only">Keep wandering <ArrowRight size={15} /></Link></div>
    <div className="cart-layout"><div className="cart-items">{cart.items.map((item) => <article className="cart-item" key={`${item.product._id}-${item.variant}`}><Link className="cart-item__image" to={`/product/${item.product.slug}`}><img src={item.product.images?.[0]} alt={item.product.name} /></Link><div className="cart-item__details"><span className="eyebrow">{item.product.category?.name ?? "An Atelier piece"}</span><h2><Link to={`/product/${item.product.slug}`}>{item.product.name}</Link></h2>{item.variant && <span className="product-meta">Selected: {formatVariant(item.variant)}</span>}<div className="cart-quantity"><button type="button" disabled={item.quantity <= 1 || busy !== ""} aria-label={`Decrease quantity of ${item.product.name}`} onClick={() => changeQuantity(item.product._id, item.variant, item.quantity - 1)}>−</button><span>{item.quantity}</span><button type="button" disabled={item.quantity >= Math.min(99, item.product.stock) || busy !== ""} aria-label={`Increase quantity of ${item.product.name}`} onClick={() => changeQuantity(item.product._id, item.variant, item.quantity + 1)}>+</button></div><button type="button" className="remove-link" disabled={busy !== ""} onClick={() => removeItem(item.product._id, item.variant)}><Trash2 size={13} /> Remove</button></div><div className="cart-item__price">{money(item.unitPrice * item.quantity)}{item.unitPrice !== item.product.price && <del>{money(item.product.price * item.quantity)}</del>}</div></article>)}
      <div className="cart-reassurance"><Truck size={17} /><span>A little something from us: delivery is on the house for orders over ₹5,000.</span></div></div>
      <aside className="order-summary"><span className="eyebrow">The picture so far</span><h2>Your order</h2><div className="summary-row"><span>Subtotal</span><span>{money(cart.totals.subtotal ?? subtotal)}</span></div>{cart.totals.discount > 0 && <div className="summary-row summary-row--discount"><span>Your little saving</span><span>−{money(cart.totals.discount)}</span></div>}<div className="summary-row"><span>Delivery</span><span>{cart.totals.shipping === 0 ? "On us" : money(cart.totals.shipping)}</span></div><div className="summary-row summary-row--total"><strong>Total</strong><strong>{money(cart.totals.total)}</strong></div>
        {cart.couponCode ? <div className="applied-coupon"><Check size={15} /> {cart.couponCode}{cart.totals.discount === 0 && <span className="field-hint"> · Minimum purchase not met yet</span>}<button type="button" onClick={removeCoupon}>Remove</button></div> : <form className="coupon-form" onSubmit={applyCoupon}><label className="sr-only" htmlFor="coupon-code">Coupon code</label><input id="coupon-code" placeholder="A little code, if you have one" value={couponCode} maxLength="40" onChange={(event) => setCouponCode(event.target.value)} /><button type="submit">Apply</button></form>}
        <p className="summary-hint">{cart.couponCode ? "Your coupon will be applied at checkout. Final totals are always confirmed before payment." : "Final totals, shipping and any eligible discounts are confirmed at checkout."}</p><button type="button" className="button button--dark summary-checkout" onClick={() => navigate("/checkout")}>Continue to checkout <ArrowRight size={15} /></button><div className="secure-note"><ShieldCheck size={16} /> Secure payment. Your card details stay with the payment provider.</div></aside></div></section>;
}

function OrderLines({ order }) {
  return <div className="order-lines">{order.items.map((item, index) => <div key={`${item.product}-${index}`} className="order-line"><div>{item.image ? <img src={item.image} alt="" loading="lazy" /> : <Package size={20} />}<span><strong>{item.name}</strong>{item.variant && <small>{formatVariant(item.variant)}</small>}<small>Qty. {item.quantity} · {money(item.unitPrice)} each</small></span></div><strong>{money(item.quantity * item.unitPrice)}</strong></div>)}</div>;
}

async function launchPayment(order, user, notify, navigate) {
  if (!window.Razorpay) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Razorpay could not load. Check your internet connection and try again."));
      document.head.appendChild(script);
    });
  }
  const { data } = await api.post("/payments/orders", { orderId: order._id });
  const checkout = new window.Razorpay({
    key: data.data.keyId,
    amount: data.data.amount,
    currency: data.data.currency,
    name: "Atelier",
    description: "A considered purchase",
    order_id: data.data.orderId,
    prefill: { name: user.name, email: user.email },
    theme: { color: "#34443a" },
    modal: { ondismiss: () => notify("Payment paused. Your order is saved, and you can continue whenever you're ready.", "error") },
    handler: async (paymentResponse) => {
      try {
        const { data: result } = await api.post("/payments/verify", paymentResponse);
        notify(result.data.paymentStatus === "paid" ? "All set. Your order is confirmed." : result.data.message ?? "Payment is processing.");
        navigate(`/orders/${order._id}`);
      } catch (error) {
        notify(apiError(error), "error");
        navigate(`/orders/${order._id}`);
      }
    },
  });
  checkout.open();
}

export function CheckoutPage() {
  const { user, notify, setItemCount } = useShop();
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [address, setAddress] = useState(() => user.addresses?.find((item) => item.isDefault) ?? user.addresses?.[0] ?? emptyAddress);
  const [couponCode, setCouponCode] = useState("");
  const [totals, setTotals] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/cart")
      .then(({ data }) => {
        setCart(data.data);
        setItemCount(data.data.items.reduce((sum, item) => sum + item.quantity, 0));
        return api.post(
          "/checkout/preview",
          data.data.couponCode ? { couponCode: data.data.couponCode } : {},
        );
      })
      .then(({ data }) => setTotals(data.data.totals))
      .catch((requestError) => setError(apiError(requestError)));
  }, [setItemCount]);

  async function updatePreview(code = couponCode) {
    try {
      const { data } = await api.post("/checkout/preview", code ? { couponCode: code } : {});
      setTotals(data.data.totals);
      setError("");
    } catch (requestError) {
      setTotals(null);
      setError(apiError(requestError));
    }
  }

  async function applyCoupon(event) {
    event.preventDefault();
    await updatePreview();
  }

  async function placeOrder(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/orders", {
        address: { ...address, isDefault: Boolean(address.isDefault) },
        couponCode,
      }, { headers: { "Idempotency-Key": crypto.randomUUID() } });
      const order = data.data.order;
      setItemCount(0);
      setBusy(false);
      await launchPayment(order, user, notify, navigate);
    } catch (requestError) {
      setBusy(false);
      setError(apiError(requestError));
    }
  }

  if (error && !cart) return <section className="empty-state empty-state--page"><h1>Your order could not load.</h1><p>{error}</p><Link className="button button--outline" to="/cart">Back to your bag</Link></section>;
  if (!cart?.items.length) return <section className="empty-state empty-state--page"><h1>Your bag feels a little light.</h1><p>Add something lovely before you head to checkout.</p><Link className="button button--dark" to="/shop">Find a favourite <ArrowRight size={15} /></Link></section>;

  return <section className="checkout-page section-wrap"><div className="breadcrumbs"><Link to="/cart">Your bag</Link><span>/</span><span>Delivery & payment</span></div><span className="eyebrow">Almost time to make it yours</span><h1>One last <em>little thing.</em></h1><form className="checkout-layout" onSubmit={placeOrder}><div className="checkout-main"><div className="checkout-block"><div className="checkout-block__title"><span>01</span><div><h2>Where should it find you?</h2><p>Your delivery address</p></div></div><div className="address-fields">
    {Object.entries({ fullName: "Full name", phone: "Phone number", line1: "Address line 1", line2: "Address line 2 (optional)", city: "City", state: "State", postalCode: "Postal code", country: "Country" }).map(([key, label]) => <label className={["line1", "line2"].includes(key) ? "address-field address-field--wide" : "address-field"} key={key}>{label}<input required={key !== "line2"} autoComplete={key === "fullName" ? "name" : key === "phone" ? "tel" : key === "line1" ? "street-address" : key} maxLength={key === "line1" || key === "line2" ? 180 : 120} value={address[key] ?? ""} onChange={(event) => setAddress((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
    </div>{user.addresses?.length > 0 && <p className="field-hint">This order uses the address entered above. <Link to="/account">Manage your saved addresses.</Link></p>}</div>
    <div className="checkout-block"><div className="checkout-block__title"><span>02</span><div><h2>Payment, safely handled.</h2><p>Secure payment through Razorpay. Card details never touch our servers.</p></div></div><div className="payment-provider"><ShieldCheck size={20} /><div><strong>Razorpay secure checkout</strong><span>UPI, cards, net banking and other supported test-mode payment methods.</span></div><Check size={18} /></div></div>
    {error && <p className="checkout-error" role="alert">{error}</p>}
    <button className="button button--dark place-order mobile-only" disabled={busy} type="submit">{busy ? "Preparing your order…" : "Place order & pay"} <ArrowRight size={15} /></button></div>
    <aside className="order-summary checkout-summary"><span className="eyebrow">A last look</span><h2>Your order</h2><OrderLines order={{ items: cart.items.map((item) => ({ ...item, name: item.product.name, image: item.product.images?.[0] })) }} /><form className="coupon-form" onSubmit={applyCoupon}><label className="sr-only" htmlFor="checkout-coupon">Coupon code</label><input id="checkout-coupon" value={couponCode} maxLength="40" onChange={(event) => setCouponCode(event.target.value)} placeholder="Coupon code" /><button type="submit">Apply</button></form><div className="summary-row"><span>Subtotal</span><span>{money(totals?.subtotal ?? cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))}</span></div>{totals?.discount > 0 && <div className="summary-row summary-row--discount"><span>Your little saving</span><span>−{money(totals.discount)}</span></div>}<div className="summary-row"><span>Delivery</span><span>{totals ? totals.shipping ? money(totals.shipping) : "On us" : "Calculated before payment"}</span></div><div className="summary-row summary-row--total"><strong>Total</strong><strong>{money(totals?.total ?? cart.totals.total)}</strong></div><p className="summary-hint">Your server-calculated total is confirmed before the payment window opens.</p><button className="button button--dark place-order desktop-only" disabled={busy} type="submit">{busy ? "Preparing your order…" : "Place order & pay"} <ArrowRight size={15} /></button><p className="checkout-legal">By placing this order, you agree to our <Link to="/terms">terms</Link>. Payment confirmation comes directly from Razorpay, not from a redirect.</p></aside></form></section>;
}

const fulfillmentTimeline = [
  { key: "pending", label: "Order placed", icon: <Check size={16} /> },
  { key: "processing", label: "Being prepared", icon: <Package size={16} /> },
  { key: "shipped", label: "On its way", icon: <Truck size={16} /> },
  { key: "delivered", label: "Arrived safely", icon: <Check size={16} /> },
];

export function OrdersPage({ detail = false }) {
  const { orderId } = useParams();
  const { user, notify } = useShop();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const request = detail ? api.get(`/orders/${orderId}`) : api.get("/orders");
    request.then(({ data }) => {
      if (cancelled) return;
      if (detail) setOrder(data.data.order);
      else setOrders(data.data.orders);
    }).catch((error) => { if (!cancelled) notify(apiError(error), "error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [detail, orderId, notify]);

  async function payAgain() {
    setBusy(true);
    try {
      await launchPayment(order, user, notify, navigate);
    } catch (error) {
      notify(apiError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder() {
    if (!window.confirm("Cancel this unpaid order and return its reserved stock?")) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/orders/${order._id}/cancel`);
      setOrder(data.data.order);
      notify("Your order has been cancelled.");
    } catch (error) {
      notify(apiError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="loading-page"><span className="spinner" />Gathering your orders…</div>;
  if (detail && !order) return <section className="empty-state empty-state--page"><h1>We couldn't find that order.</h1><Link to="/orders" className="button button--outline">Your order history</Link></section>;
  if (detail) {
    const cancelled = order.status === "cancelled" || order.status === "refunded";
    const activeIndex = fulfillmentTimeline.findIndex((item) => item.key === order.status);
    return <section className="account-content section-wrap"><div className="breadcrumbs"><Link to="/account">My account</Link><span>/</span><Link to="/orders">Your orders</Link><span>/</span><span>Order #{order._id.slice(-8).toUpperCase()}</span></div><Link to="/orders" className="text-link"><ArrowLeft size={15} /> All orders</Link><div className="order-detail-title"><div><span className="eyebrow">{new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })}</span><h1>A little <em>something lovely.</em></h1><p>Order #{order._id.slice(-8).toUpperCase()}</p></div><span className={`order-status order-status--${order.status}`}>{order.status}</span></div>
      {order.status !== "cancelled" && order.status !== "refunded" && <div className="order-timeline" aria-label={`Order ${order.status}`}><div className="timeline-line" />{fulfillmentTimeline.map((step, index) => { const complete = activeIndex >= index && ["paid", "not_required"].includes(order.paymentStatus); return <div key={step.key} className={`timeline-step ${complete ? "timeline-step--complete" : ""}`}><span className="timeline-icon">{complete ? step.icon : index === 0 ? <Clock3 size={16} /> : <span>{index + 1}</span>}</span><small>{step.label}</small></div>; })}</div>}
      {order.paymentStatus !== "paid" && order.status === "pending" && <div className="payment-reminder"><ShieldCheck size={19} /><div><strong>{order.paymentStatus === "failed" ? "Your last payment didn't go through." : "Your order is saved and waiting."}</strong><p>Finish your secure Razorpay payment to confirm it. Your items are reserved while the order is pending.</p></div><button className="button button--dark" type="button" disabled={busy} onClick={payAgain}>{busy ? "Opening…" : "Complete payment"}</button></div>}
      {["paid", "not_required"].includes(order.paymentStatus) && <div className="order-confirmed"><Check size={19} /><span>{order.paymentStatus === "not_required" ? "This complimentary order needs no payment." : "Your payment is verified."} {order.status === "processing" ? "We're preparing your order." : `This order is ${order.status}.`}</span></div>}
      {order.status === "pending" && order.paymentStatus !== "paid" && <button type="button" className="remove-link order-cancel-link" disabled={busy} onClick={cancelOrder}>Cancel this unpaid order</button>}
      <div className="order-detail-grid"><div className="account-panel"><span className="eyebrow">A closer look</span><h2>In your order</h2><OrderLines order={order} /><div className="summary-row"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>{order.discount > 0 && <div className="summary-row summary-row--discount"><span>Discount</span><span>−{money(order.discount)}</span></div>}<div className="summary-row"><span>Delivery</span><span>{order.shipping ? money(order.shipping) : "On us"}</span></div><div className="summary-row summary-row--total"><strong>Total · {order.currency}</strong><strong>{money(order.total)}</strong></div><div className="payment-record">Payment: <strong>{order.paymentStatus}</strong></div></div><aside className="account-panel"><span className="eyebrow">For the delivery person</span><h2>Your address</h2><address><strong>{order.shippingAddress.fullName}</strong><br />{order.shippingAddress.line1}{order.shippingAddress.line2 && <><br />{order.shippingAddress.line2}</>}<br />{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />{order.shippingAddress.country}<br />{order.shippingAddress.phone}</address><Link to="/contact" className="text-link">Questions? We're here <ArrowRight size={15} /></Link></aside></div></section>;
  }

  return <section className="account-content section-wrap"><div className="account-heading"><div><span className="eyebrow">A story of good choices</span><h1>Your <em>orders.</em></h1></div><Link to="/account" className="text-link">Back to your account <ArrowRight size={15} /></Link></div>{orders.length ? <div className="orders-list">{orders.map((item) => <article key={item._id} className="order-list-card"><div className="order-list-card__header"><div><span className="eyebrow">{new Date(item.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })}</span><h2>Order #{item._id.slice(-8).toUpperCase()}</h2></div><span className={`order-status order-status--${item.status}`}>{item.status}</span></div><div className="order-list-card__products">{item.items.slice(0, 3).map((product, index) => product.image ? <img key={`${item._id}-${index}`} src={product.image} alt={product.name} loading="lazy" title={product.name} /> : <span key={index}>{product.name[0]}</span>)}<p>{item.items.length} {item.items.length === 1 ? "piece" : "pieces"} · {money(item.total)} · {item.paymentStatus}</p></div><Link className="text-link" to={`/orders/${item._id}`}>See the whole story <ArrowRight size={14} /></Link></article>)}</div> : <div className="empty-state empty-state--inline"><span className="empty-state__mark">a.</span><h2>Nothing's been ordered yet.</h2><p>Your next favourite is just a little browsing away.</p><Link to="/shop" className="button button--dark">Browse the collection <ArrowRight size={15} /></Link></div>}</section>;
}

export function AccountPage() {
  const { user, setUser, notify } = useShop();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState(user.addresses ?? []);
  const [editing, setEditing] = useState(false);
  const [addressForm, setAddressForm] = useState({ ...emptyAddress });
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/orders").then(({ data }) => setOrders(data.data.orders))
      .catch((error) => notify(apiError(error), "error"));
  }, [notify]);

  async function signOut() {
    try {
      await api.post("/auth/logout");
      setUser(null);
      navigate("/");
      notify("You've been signed out.");
    } catch (error) {
      notify(apiError(error), "error");
    }
  }

  async function saveName(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.patch("/auth/me", { name });
      setUser(data.data.user);
      notify("A little name update. All saved.");
    } catch (error) {
      notify(apiError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveAddress(event) {
    event.preventDefault();
    const validated = addressSchema.safeParse(addressForm);
    if (!validated.success) return notify(validated.error.issues[0].message, "error");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/me/addresses", validated.data);
      setAddresses(data.data.addresses);
      setUser({ ...user, addresses: data.data.addresses });
      setAddressForm({ ...emptyAddress });
      setEditing(false);
      notify("Delivery address saved.");
    } catch (error) {
      notify(apiError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAddress(id) {
    try {
      const { data } = await api.delete(`/auth/me/addresses/${id}`);
      setAddresses(data.data.addresses);
      setUser({ ...user, addresses: data.data.addresses });
      notify("Saved address removed.");
    } catch (error) {
      notify(apiError(error), "error");
    }
  }

  return <section className="account-content section-wrap"><div className="account-heading"><div><span className="eyebrow">A little corner of your own</span><h1>Hello, <em>{user.name.split(" ")[0]}.</em></h1></div><button type="button" className="text-link account-signout" onClick={signOut}>Sign out <ArrowRight size={15} /></button></div>
    <div className="account-dashboard"><aside className="account-sidebar"><span className="eyebrow">Your space</span><Link className="account-nav-item account-nav-item--active" to="/account">Overview <ArrowRight size={14} /></Link><Link className="account-nav-item" to="/orders">Order history <ArrowRight size={14} /></Link><Link className="account-nav-item" to="/wishlist">Your wishlist <ArrowRight size={14} /></Link><Link className="account-nav-item" to="/account#addresses">Delivery addresses <ArrowRight size={14} /></Link><Link className="account-nav-item" to="/account#password">Change password <ArrowRight size={14} /></Link></aside>
      <div className="account-panels"><div className="account-panel"><div className="panel-heading"><div><span className="eyebrow">Your little introduction</span><h2>Profile details</h2></div>{!busy && <Check size={17} />}</div><form className="profile-form" onSubmit={saveName}><label>Your name<input required minLength="2" maxLength="100" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label><label>Email address<input value={user.email} readOnly disabled /></label><button type="submit" className="button button--outline" disabled={busy}>Save your name</button></form><p className="field-hint"><Link to="/forgot-password">Want to change your password?</Link> Request a secure reset link.</p></div>
        <div className="account-panel" id="addresses"><div className="panel-heading"><div><span className="eyebrow">For the delivery person</span><h2>Saved addresses</h2></div>{!editing && <button className="text-link" type="button" onClick={() => setEditing(true)}>Add one +</button>}</div>{addresses.length === 0 && !editing && <p className="empty-note">Your next delivery needs somewhere to find you.</p>}{addresses.map((address) => <div key={address._id} className="saved-address"><div><strong>{address.label}{address.isDefault && " · Default"}</strong><address>{address.fullName}<br />{address.line1}{address.line2 && `, ${address.line2}`}<br />{address.city}, {address.state} {address.postalCode}<br />{address.phone}</address></div><button type="button" className="icon-button" onClick={() => deleteAddress(address._id)} aria-label={`Remove ${address.label} address`}><Trash2 size={16} /></button></div>)}{editing && <form className="form-card inline-address-form" onSubmit={saveAddress}><span className="eyebrow">A new place</span><div className="address-fields">{Object.entries({ label: "Address name", fullName: "Full name", phone: "Phone number", line1: "Address line 1", line2: "Address line 2", city: "City", state: "State", postalCode: "Postal code", country: "Country" }).map(([key, label]) => <label className={["line1", "line2"].includes(key) ? "address-field address-field--wide" : "address-field"} key={key}>{label}<input required={key !== "line2"} value={addressForm[key]} onChange={(event) => setAddressForm({ ...addressForm, [key]: event.target.value })} /></label>)}</div><label className="checkbox-field"><input type="checkbox" checked={Boolean(addressForm.isDefault)} onChange={(event) => setAddressForm({ ...addressForm, isDefault: event.target.checked })} /> Make this my default address</label><div className="form-actions"><button className="button button--dark" type="submit" disabled={busy}>Save this address</button><button className="text-link" type="button" onClick={() => setEditing(false)}>Not now</button></div></form>}</div>
        <div className="account-panel" id="password"><div className="panel-heading"><div><span className="eyebrow">Keep your space yours</span><h2>Account security</h2></div><ShieldCheck size={18} /></div><p>Your password is securely hashed and never stored in plain text. <Link to="/forgot-password">Use the secure reset link</Link> to change it.</p></div>
      </div></div>
    <section className="account-recent-orders"><div className="section-heading"><div><span className="eyebrow">A few things you've made yours</span><h2>Recently <em>ordered.</em></h2></div><Link to="/orders" className="text-link">All orders <ArrowRight size={15} /></Link></div>{orders.length ? orders.slice(0, 2).map((order) => <article key={order._id} className="recent-order-row"><div className="recent-order-items">{order.items.slice(0, 3).map((item, index) => item.image && <img key={index} src={item.image} alt="" loading="lazy" />)}<div><span>ORDER #{order._id.slice(-8).toUpperCase()}</span><strong>{order.items.length} {order.items.length === 1 ? "piece" : "pieces"} · {money(order.total)}</strong></div></div><span className={`order-status order-status--${order.status}`}>{order.status}</span><Link aria-label={`View order ${order._id.slice(-8)}`} className="icon-button" to={`/orders/${order._id}`}><ArrowRight size={17} /></Link></article>) : <p className="empty-note">Your first good choice is still out there. <Link to="/shop">Go find it.</Link></p>}</section></section>;
}

export function WishlistPage() {
  const { notify } = useShop();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/auth/me/wishlist")
      .then(({ data }) => setProducts(data.data.products))
      .catch((error) => notify(apiError(error), "error"))
      .finally(() => setLoading(false));
  }, [notify]);
  return <section className="account-content section-wrap"><div className="account-heading"><div><span className="eyebrow">Good things to remember</span><h1>Your little <em>wishlist.</em></h1></div><Link className="text-link" to="/account">My account <ArrowRight size={15} /></Link></div>{loading ? <div className="loading-page"><span className="spinner" />Gathering your saved things…</div> : products.length ? <div className="product-grid">{products.map((product, index) => <WishlistCard key={product._id} product={product} index={index} onRemove={async () => { try { await api.put(`/auth/me/wishlist/${product._id}`); setProducts((saved) => saved.filter((item) => item._id !== product._id)); notify("No longer on your wishlist."); } catch (error) { notify(apiError(error), "error"); } }} />)}</div> : <div className="empty-state empty-state--inline"><span className="empty-state__mark">a.</span><h2>Nothing saved just yet.</h2><p>Save the pieces you love and come back to them whenever you like.</p><Link className="button button--dark" to="/shop">Find something good <ArrowRight size={15} /></Link></div>}</section>;
}

function WishlistCard({ product, index, onRemove }) {
  return <article className="wishlist-card"><ProductCardSimple product={product} index={index} /><button className="remove-link" type="button" onClick={onRemove}><Trash2 size={13} /> Remove from wishlist</button></article>;
}

function ProductCardSimple({ product, index }) {
  return <div className="product-card"><Link className="product-card__media" to={`/product/${product.slug}`}><img src={product.images?.[0]} alt={product.name} loading="lazy" width="680" height="820" /></Link><div className="product-card__details"><div><h3><Link to={`/product/${product.slug}`}>{product.name}</Link></h3><span className="product-meta">{product.category?.name ?? product.brand}</span></div><span>{money(product.price)}</span></div></div>;
}
