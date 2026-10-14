import { useEffect, useState } from "react";
import { Activity, ArrowDownRight, ArrowRight, BarChart3, Box, Check, ChevronRight, CircleDollarSign, FileText, FolderOpen, Gauge, Inbox, Layers3, Package, Plus, RefreshCw, ShieldCheck, ShoppingBag, Sparkles, Tags, Users, Warehouse } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, apiError, money } from "../api.js";
import { useShop } from "../context.jsx";

const navigation = [
  { label: "Overview", path: "/admin", icon: Gauge },
  { label: "Products", path: "/admin/products", icon: Box },
  { label: "Categories", path: "/admin/categories", icon: Layers3 },
  { label: "Orders", path: "/admin/orders", icon: ShoppingBag },
  { label: "Customers", path: "/admin/customers", icon: Users },
  { label: "Inventory", path: "/admin/inventory", icon: Warehouse },
  { label: "Coupons", path: "/admin/coupons", icon: Tags },
  { label: "Reviews", path: "/admin/reviews", icon: Sparkles },
  { label: "Messages", path: "/admin/messages", icon: Inbox },
  { label: "Reports", path: "/admin/analytics", icon: BarChart3 },
  { label: "Settings", path: "/admin/settings", icon: FileText },
];

export default function AdminPage() {
  const location = useLocation();
  const current = navigation.find((item) => item.path === location.pathname);
  return (
    <section className="admin-layout">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand"><span className="wordmark">atelier<span>.</span></span><span>THE STUDIO</span></Link>
        <div className="admin-sidebar__label">YOUR SHOP</div>
        <nav className="admin-navigation" aria-label="Store administration">
          {navigation.map(({ label, path, icon: Icon }) => <Link key={path} to={path} className={location.pathname === path ? "admin-nav-link admin-nav-link--active" : "admin-nav-link"}><Icon size={17} strokeWidth={1.7} />{label}{location.pathname === path && <ChevronRight size={13} />}</Link>)}
        </nav>
        <div className="admin-sidebar-note"><span><ShieldCheck size={16} /> PRIVATE STUDIO</span><p>Only you can see these numbers. They belong to your store.</p></div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar"><div><span className="eyebrow">YOUR ATELIER / {current?.label.toUpperCase() ?? (location.pathname.includes("products/new") ? "NEW PIECE" : "THE STUDIO")}</span><h1>{current?.label ?? "Your studio"}<span> · Atelier</span></h1></div><Link to="/shop" className="text-link">Back to the shop <ArrowRight size={15} /></Link></header>
        <div className="admin-content">{location.pathname === "/admin" ? <Overview /> : location.pathname.startsWith("/admin/products/new") || location.pathname.startsWith("/admin/products/") && location.pathname !== "/admin/products" ? <ProductEditor /> : location.pathname === "/admin/products" || location.pathname === "/admin/inventory" ? <ProductsAdmin inventoryOnly={location.pathname === "/admin/inventory"} /> : location.pathname === "/admin/categories" ? <CategoriesAdmin /> : location.pathname === "/admin/orders" ? <OrdersAdmin /> : location.pathname === "/admin/customers" ? <CustomersAdmin /> : location.pathname === "/admin/coupons" ? <CouponsAdmin /> : location.pathname === "/admin/reviews" ? <ReviewsAdmin /> : location.pathname === "/admin/messages" ? <MessagesAdmin /> : location.pathname === "/admin/analytics" ? <ReportsAdmin /> : location.pathname === "/admin/settings" ? <SettingsAdmin /> : <Overview />}</div>
      </div>
    </section>
  );
}

function useAdminData(path, dependencies = []) {
  const { notify } = useShop();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(path).then(({ data: result }) => {
      if (!cancelled) setData(result.data);
    }).catch((error) => {
      if (!cancelled) notify(apiError(error), "error");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [path, reloadKey, notify, ...dependencies]);
  return { data, loading, reload: () => setReloadKey((key) => key + 1) };
}

function StatCard({ title, value, note, icon: Icon }) {
  return <article className="admin-stat"><div className="admin-stat__top"><span>{title}</span><Icon size={18} /></div><strong>{value}</strong><span className="admin-stat__note">{note}</span></article>;
}

function SectionHead({ eyebrow, title, description, action }) {
  return <div className="admin-section-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}

export function Overview() {
  const [days, setDays] = useState(30);
  const { data, loading } = useAdminData(`/admin/overview?days=${days}`, [days]);
  if (loading) return <AdminLoading />;
  if (!data) return <EmptyAdmin title="Your studio couldn’t load." />;
  const peak = Math.max(1, ...data.salesTrend.map((day) => day.revenue));
  return <div className="admin-overview">
    <div className="overview-welcome"><div><span className="eyebrow"><Sparkles size={13} /> THE LAST LITTLE WHILE</span><h2>Things are finding <em>their way.</em></h2><p>Here’s how the real orders in your shop are looking. No guesswork, only completed payments.</p></div><Link to="/admin/orders" className="button button--outline">See your orders <ArrowRight size={14} /></Link></div>
    <div className="admin-stats">
      <StatCard title="Paid revenue · lifetime" value={money(data.metrics.revenue)} note={`${data.metrics.paidOrders} confirmed paid orders`} icon={CircleDollarSign} />
      <StatCard title="Every order" value={data.metrics.orders.toLocaleString("en-IN")} note="Includes pending and cancelled orders" icon={ShoppingBag} />
      <StatCard title="Lovely people" value={data.metrics.customers.toLocaleString("en-IN")} note="Customer accounts" icon={Users} />
      <StatCard title="Available pieces" value={data.metrics.products.toLocaleString("en-IN")} note={`${data.lowStock.length} things on low stock`} icon={Box} />
    </div>
    <div className="admin-two-column"><section className="admin-panel sales-panel"><SectionHead eyebrow="ONLY CONFIRMED PAID SALES" title="A steadier rhythm." action={<select aria-label="Sales trend range" value={days} onChange={(event) => setDays(Number(event.target.value))}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">365 days</option></select>} />{data.salesTrend.length ? <div className="sales-chart" role="img" aria-label={`Verified daily sales over the last ${days} days`}><div className="sales-chart__bars">{data.salesTrend.slice(-14).map((day) => <div title={`${day._id} · ${money(day.revenue)}`} className="sales-chart__bar-wrap" key={day._id}><div className="sales-chart__bar" style={{ height: `${Math.max(4, Math.round((day.revenue / peak) * 100))}%` }} /><span>{new Date(`${day._id}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div>)}</div></div> : <div className="chart-empty"><Activity size={22} /><p>When a verified order arrives, your daily rhythm will show here.</p></div>}</section>
      <section className="admin-panel inventory-panel"><SectionHead eyebrow="JUST A FEW LEFT" title="Keep an eye on these." action={<Link className="text-link" to="/admin/inventory">All inventory <ArrowRight size={13} /></Link>} />{data.lowStock.length ? <div className="low-stock-list">{data.lowStock.map((item) => <div className="low-stock-item" key={item._id}><span className="low-stock-indicator" /><div><strong>{item.name}</strong><span>SKU · {item.sku}</span></div><b>{item.stock} left</b></div>)}</div> : <div className="chart-empty"><Check size={20} /><p>Everything's in stock. No quiet emergencies today.</p></div>}</section></div>
    <section className="admin-panel recent-orders-panel"><SectionHead eyebrow="THE MOST RECENTLY PLACED" title="Latest orders." action={<Link className="text-link" to="/admin/orders">All the orders <ArrowRight size={13} /></Link>} />{data.recentOrders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Payment</th><th>Fulfillment</th><th>Total</th></tr></thead><tbody>{data.recentOrders.map((order) => <tr key={order._id}><td>#{order._id.slice(-8).toUpperCase()}</td><td>{order.user?.name ?? "Customer"}<span className="table-secondary">{order.user?.email}</span></td><td>{new Date(order.createdAt).toLocaleDateString("en-IN")}</td><td><span className={`payment-pill payment-pill--${order.paymentStatus}`}>{order.paymentStatus}</span></td><td>{order.status}</td><td>{money(order.total)}</td></tr>)}</tbody></table></div> : <div className="chart-empty">Your first order will show up here, once it has actually been placed.</div>}</section>
    <section className="admin-panel"><SectionHead eyebrow="THE PIECES THAT GO FURTHEST" title="Quietly popular." description="Ranked by units sold across actually-paid orders." />{data.topProducts.length ? <div className="top-products">{data.topProducts.map((product, index) => <div key={product._id} className="top-product"><span>0{index + 1}</span><div><strong>{product.name}</strong><small>{product.units} units sold</small></div><strong>{money(product.revenue)}</strong></div>)}</div> : <div className="chart-empty">Paid product sales will appear here when your first real order arrives.</div>}</section>
  </div>;
}

function AdminLoading() {
  return <div className="loading-page"><span className="spinner" />Opening the studio…</div>;
}
function EmptyAdmin({ title }) {
  return <div className="empty-state empty-state--inline"><h2>{title}</h2><Link to="/admin" className="text-link">Back to your studio <ArrowRight size={14} /></Link></div>;
}

function useAdminAction() {
  const { notify } = useShop();
  const [busy, setBusy] = useState(false);
  const run = async (action, success, reload) => {
    setBusy(true);
    try {
      await action();
      if (success) notify(success);
      if (reload) await reload();
      return true;
    } catch (error) {
      notify(apiError(error), "error");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export function ProductsAdmin({ inventoryOnly = false }) {
  const { data, loading, reload } = useAdminData("/admin/products");
  const { notify } = useShop();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const products = data?.products.filter((item) => `${item.name} ${item.sku}`.toLowerCase().includes(query.toLowerCase())) ?? [];
  async function archive(product) {
    if (!window.confirm(`Archive "${product.name}"? It will no longer appear in the shop.`)) return;
    setBusyId(product._id);
    try {
      await api.delete(`/admin/products/${product._id}`);
      notify("This product has been safely archived.");
      await reload();
    } catch (error) {
      notify(apiError(error), "error");
    } finally {
      setBusyId("");
    }
  }
  if (loading) return <AdminLoading />;
  return <div className="admin-panel"><SectionHead eyebrow={inventoryOnly ? "WHAT'S READY TO SHIP" : "YOUR WHOLE COLLECTION"} title={inventoryOnly ? "A careful inventory." : "Things you can actually shop."} description={inventoryOnly ? "Live product records and the stock counts behind them." : "A real list of the pieces you currently offer."} action={!inventoryOnly && <button className="button button--dark admin-create-button" type="button" onClick={() => navigate("/admin/products/new")}><Plus size={15} /> Add a piece</button>} /><div className="admin-table-tools"><label>Find a product<input type="search" placeholder="Name or SKU" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span>{products.length} / {data?.products.length ?? 0} pieces</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>The piece</th><th>Category</th><th>SKU</th><th>Price</th><th>In stock</th><th>State</th>{!inventoryOnly && <th>Actions</th>}</tr></thead><tbody>{products.map((product) => <tr key={product._id}><td className="product-table-name">{product.images?.[0] && <img src={product.images[0]} alt="" />}{product.name}</td><td>{product.category?.name ?? "—"}</td><td>{product.sku}</td><td>{money(product.price)}</td><td><span className={product.stock <= 5 ? "inventory-number inventory-number--low" : "inventory-number"}>{product.stock}{product.stock <= 5 && " · low"}</span></td><td><span className={`payment-pill ${product.isActive ? "payment-pill--paid" : "payment-pill--failed"}`}>{product.isActive ? "Listed" : "Archived"}</span></td>{!inventoryOnly && <td><div className="table-actions"><button type="button" onClick={() => navigate(`/admin/products/${product._id}`)}>Edit</button>{product.isActive && <button type="button" disabled={busyId === product._id} onClick={() => archive(product)}>Archive</button>}</div></td>}</tr>)}{products.length === 0 && <tr><td colSpan={inventoryOnly ? 6 : 7} className="table-empty">No pieces matched that search. <button type="button" onClick={() => setQuery("")}>Clear search</button></td></tr>}</tbody></table></div></div>;
}

export function ProductEditor() {
  const { pathname } = useLocation();
  const id = pathname === "/admin/products/new" ? null : pathname.split("/").pop();
  const editing = Boolean(id && id !== "products");
  const navigate = useNavigate();
  const { notify } = useShop();
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(false);
  const [product, setProduct] = useState({ name: "", slug: "", description: "", category: "", brand: "Atelier", images: [], sku: "", price: "", discountPercent: "0", stock: "0", variants: [], isActive: true, featured: false });
  useEffect(() => {
    let cancelled = false;
    const requests = [api.get("/admin/categories"), ...(editing ? [api.get("/admin/products").then(({ data }) => data)] : [])];
    Promise.all(requests).then((results) => {
      if (cancelled) return;
      setCategories(results[0].data.data.categories);
      if (editing) {
        const found = results[1].products.find((item) => item._id === id);
        if (!found) {
          notify("That product could not be found.", "error");
          navigate("/admin/products");
          return;
        }
        setProduct({ ...found, category: found.category?._id ?? "", price: String(found.price), discountPercent: String(found.discountPercent), stock: String(found.stock), variants: (found.variants ?? []).map((variant) => ({ ...variant, options: [...variant.options] })) });
      }
    }).catch((error) => { if (!cancelled) notify(apiError(error), "error"); });
    return () => { cancelled = true; };
  }, [editing, id, navigate, notify]);

  function update(key, value) {
    setProduct((current) => ({ ...current, [key]: value }));
  }
  function updateVariant(index, key, value) {
    update("variants", product.variants.map((variant, current) =>
      current === index ? { ...variant, [key]: value } : variant,
    ));
  }
  function addVariant() {
    if (product.variants.length >= 3) return notify("A piece can have up to three option groups.", "error");
    update("variants", [...product.variants, { name: "", options: [] }]);
  }
  async function uploadImage(file) {
    const payload = new FormData();
    payload.append("image", file);
    const { data } = await api.post("/admin/uploads", payload, { headers: { "Content-Type": "multipart/form-data" } });
    setProduct((current) => ({ ...current, images: [...current.images, data.data.url].slice(0, 8) }));
    notify("Your product image is in Cloudinary.");
  }
  async function save(event) {
    event.preventDefault();
    if (!product.category) return notify("Choose an active category.", "error");
    setBusy(true);
    const payload = {
      ...product,
      price: Number(product.price),
      discountPercent: Number(product.discountPercent),
      stock: Number(product.stock),
      variants: product.variants.map((variant) => ({
        ...variant,
        options: variant.options.map((option) => option.trim()).filter(Boolean),
      })),
    };
    try {
      if (editing) await api.put(`/admin/products/${id}`, payload);
      else await api.post("/admin/products", payload);
      notify(editing ? "Your product has been updated." : "Your new piece is ready.");
      navigate("/admin/products");
    } catch (error) {
      notify(apiError(error), "error");
    } finally {
      setBusy(false);
    }
  }
  return <form className="admin-panel admin-product-form" onSubmit={save}><SectionHead eyebrow="REAL THINGS, REAL DETAILS" title={editing ? "Give this piece a little polish." : "A new piece for the shop."} description="The store validates everything before saving it." action={<button className="button button--dark" type="submit" disabled={busy}>{busy ? "Saving…" : "Save this piece"}</button>} />
    <div className="admin-form-grid"><label>Product name<input required minLength="2" maxLength="160" value={product.name} onChange={(event) => { const name = event.target.value; update("name", name); if (!editing) update("slug", name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} /></label><label>URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength="160" value={product.slug} onChange={(event) => update("slug", event.target.value)} /></label><label>SKU<input required maxLength="80" value={product.sku} onChange={(event) => update("sku", event.target.value.toUpperCase())} /></label><label>Category<select required value={product.category} onChange={(event) => update("category", event.target.value)}><option value="">Choose a category</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label><label>Price in INR<input required type="number" min="1" step="1" value={product.price} onChange={(event) => update("price", event.target.value)} /></label><label>Discount · percentage<input type="number" min="0" max="100" step="1" value={product.discountPercent} onChange={(event) => update("discountPercent", event.target.value)} /></label><label>Units in stock<input required type="number" min="0" step="1" value={product.stock} onChange={(event) => update("stock", event.target.value)} /></label><label>Maker / brand<input maxLength="100" value={product.brand} onChange={(event) => update("brand", event.target.value)} /></label><label className="admin-form-field--wide">A thoughtful description<textarea required minLength="10" maxLength="5000" rows="5" value={product.description} onChange={(event) => update("description", event.target.value)} /></label><fieldset className="image-picker admin-form-field--wide"><legend>Photographs <span>· Up to eight images</span></legend><div className="image-picker-list">{product.images.map((image, index) => <button key={`${image}-${index}`} type="button" title="Remove image" onClick={() => update("images", product.images.filter((_, current) => current !== index))}><img src={image} alt={`Product photograph ${index + 1}`} /><span aria-hidden="true">×</span></button>)}</div><label className="upload-button"><Plus size={15} /> Add an image via Cloudinary<input type="file" accept="image/jpeg,image/png,image/webp" disabled={product.images.length >= 8} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadImage(file).catch((error) => notify(apiError(error), "error")); event.target.value = ""; }} /></label><p className="field-hint">Up to 5 MB · JPEG, PNG or WebP. Cloudinary credentials must be configured on the server.</p><label className="admin-form-field--wide">Or add an existing image URL<input type="url" placeholder="https://…" value={product.url ?? ""} onChange={(event) => update("url", event.target.value)} onBlur={() => { if (product.url && /^https?:\/\//i.test(product.url) && product.images.length < 8) update("images", [...product.images, product.url].slice(0, 8)); if (product.url) update("url", ""); }} /></label></fieldset><div className="form-checks admin-form-field--wide"><label className="checkbox-field"><input type="checkbox" checked={Boolean(product.featured)} onChange={(event) => update("featured", event.target.checked)} /> Include in the featured edit</label><label className="checkbox-field"><input type="checkbox" checked={Boolean(product.isActive)} onChange={(event) => update("isActive", event.target.checked)} /> Available in the storefront</label></div></div>
    <div className="admin-form-grid"><fieldset className="image-picker admin-form-field--wide"><legend>Options <span>· Up to three groups</span></legend>{product.variants.map((variant, index) => <div className="admin-variant" key={`${variant.name}-${index}`}><label>Option group<input required maxLength="24" placeholder="Size" value={variant.name} onChange={(event) => updateVariant(index, "name", event.target.value)} /></label><label>Choices <span>· comma separated</span><input required maxLength="500" placeholder="Small, Medium, Large" value={variant.options.join(", ")} onChange={(event) => updateVariant(index, "options", event.target.value.split(","))} /></label><button className="icon-button" type="button" aria-label={`Remove ${variant.name || "option group"}`} onClick={() => update("variants", product.variants.filter((_, current) => current !== index))}>×</button></div>)}<button className="button button--outline" type="button" disabled={product.variants.length >= 3} onClick={addVariant}><Plus size={15} /> Add option group</button></fieldset></div>
  </form>;
}

export function CategoriesAdmin() {
  const { data, loading, reload } = useAdminData("/admin/categories");
  const { run, busy } = useAdminAction();
  const [form, setForm] = useState({ name: "", slug: "", description: "", image: "" });
  async function createCategory(event) {
    event.preventDefault();
    await run(async () => {
      await api.post("/admin/categories", form);
      setForm({ name: "", slug: "", description: "", image: "" });
    }, "A new collection has found its place.", reload);
  }
  if (loading) return <AdminLoading />;
  return <div className="admin-two-column admin-categories"><section className="admin-panel"><SectionHead eyebrow="THE COLLECTIONS THAT FEEL LIKE HOME" title="Your categories." />{data?.categories.map((category) => <article className="category-admin-card" key={category._id}>{category.image && <img src={category.image} alt="" /> }<div><strong>{category.name}</strong><span>/{category.slug}</span><p>{category.description}</p></div><span className={category.isActive ? "payment-pill payment-pill--paid" : "payment-pill payment-pill--failed"}>{category.isActive ? "Live" : "Hidden"}</span></article>)}</section><form className="admin-panel admin-create-form" onSubmit={createCategory}><span className="eyebrow">A place for more good things</span><h2>New category.</h2><label>Name<input required minLength="2" maxLength="80" value={form.name} onChange={(event) => { const name = event.target.value; setForm({ ...form, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }); }} /></label><label>URL slug<input required maxLength="80" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label><label>A little description<textarea maxLength="400" rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Photograph URL<input type="url" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} /></label><button className="button button--dark" type="submit" disabled={busy}><Plus size={15} /> Add this category</button></form></div>;
}

export function OrdersAdmin() {
  const { data, loading, reload } = useAdminData("/admin/orders");
  const { run } = useAdminAction();
  const [refundAmounts, setRefundAmounts] = useState({});
  if (loading) return <AdminLoading />;
  return <div className="admin-panel"><SectionHead eyebrow="EVERY ORDER, EXACTLY AS IT IS" title="The order book." description="Payment state is confirmed by Razorpay. Fulfillment is yours to move." /><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Pieces</th><th>Payment</th><th>Status</th><th>Total</th></tr></thead><tbody>{data?.orders.map((order) => <tr key={order._id}><td><Link to={`/orders/${order._id}`} target="_blank">#{order._id.slice(-8).toUpperCase()}</Link><span className="table-secondary">{new Date(order.createdAt).toLocaleDateString("en-IN")}</span></td><td>{order.user?.name}<span className="table-secondary">{order.user?.email}</span></td><td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td><span className={`payment-pill payment-pill--${order.paymentStatus}`}>{order.paymentStatus}</span></td><td><select aria-label={`Update fulfillment for order ${order._id.slice(-8)}`} value={order.status} onChange={(event) => { const nextStatus = event.target.value; if (window.confirm(`Move order #${order._id.slice(-8).toUpperCase()} to ${nextStatus}?`)) run(() => api.patch(`/admin/orders/${order._id}/status`, { status: nextStatus }), "Order status updated.", reload); }}><option value={order.status}>{order.status}</option>{({ pending: ["processing", "cancelled"], processing: ["shipped", "cancelled"], shipped: ["delivered"] }[order.status] ?? []).filter((next) => next !== "processing" || ["paid", "not_required"].includes(order.paymentStatus)).filter((next) => next !== "cancelled" || order.paymentStatus !== "paid").map((next) => <option key={next} value={next}>{next}</option>)}</select>{order.paymentStatus === "paid" && order.status !== "refunded" && <div className="refund-control"><input aria-label="Partial refund amount in paise" type="number" min="1" placeholder="Refund ₹ in paise" value={refundAmounts[order._id] ?? ""} onChange={(event) => setRefundAmounts({ ...refundAmounts, [order._id]: event.target.value })} /><button type="button" onClick={() => { const raw = refundAmounts[order._id]; if (!window.confirm(`Request a refund of ${raw ? `${money(Number(raw) / 100)} ` : "the remaining " }for this order?`)) return; run(() => api.post(`/admin/orders/${order._id}/refund`, raw ? { amount: Number(raw) } : {}, { headers: { "Idempotency-Key": crypto.randomUUID() } }), "Razorpay is processing your refund request.", reload); }}>Refund</button><small>Enter amount in paise. Leave blank for full refund.</small></div>}</td><td>{money(order.total)}</td></tr>)}{!data?.orders.length && <tr><td colSpan="6" className="table-empty">There are no orders yet.</td></tr>}</tbody></table></div></div>;
}

export function CustomersAdmin() {
  const { data, loading } = useAdminData("/admin/customers");
  if (loading) return <AdminLoading />;
  return <div className="admin-panel"><SectionHead eyebrow="JUST YOUR STORE'S CUSTOMER ACCOUNTS" title="People who found their way here." description="Names, email and join dates only. Personal addresses stay private." /><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Account since</th></tr></thead><tbody>{data?.customers.map((person) => <tr key={person._id}><td>{person.name}</td><td>{person.email}</td><td>{new Date(person.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })}</td></tr>)}{!data?.customers.length && <tr><td colSpan="3" className="table-empty">Your first customers will appear here.</td></tr>}</tbody></table></div></div>;
}

export function CouponsAdmin() {
  const { data, loading, reload } = useAdminData("/admin/coupons");
  const { run, busy } = useAdminAction();
  const [form, setForm] = useState({ code: "", type: "percent", value: "", minimumPurchase: "0", usageLimit: "100", endsAt: "" });
  async function createCoupon(event) {
    event.preventDefault();
    const payload = { ...form, code: form.code.toUpperCase(), value: Number(form.value), minimumPurchase: Number(form.minimumPurchase), usageLimit: Number(form.usageLimit) };
    await run(() => api.post("/admin/coupons", payload), "Your new coupon is ready.", reload);
    setForm({ code: "", type: "percent", value: "", minimumPurchase: "0", usageLimit: "100", endsAt: "" });
  }
  if (loading) return <AdminLoading />;
  return <div className="admin-two-column"><section className="admin-panel"><SectionHead eyebrow="REAL COUPONS IN YOUR STORE" title="The little thank-yous." />{data?.coupons.map((coupon) => <div className="coupon-row" key={coupon._id}><strong>{coupon.code}</strong><span>{coupon.type === "percent" ? `${coupon.value}% off` : money(coupon.value)}</span><span>{coupon.usageCount} / {coupon.usageLimit} uses</span><span className={coupon.isActive && new Date(coupon.endsAt) > new Date() ? "payment-pill payment-pill--paid" : "payment-pill payment-pill--failed"}>{coupon.isActive && new Date(coupon.endsAt) > new Date() ? "Active" : "Ended"}</span></div>)}{!data?.coupons.length && <p className="empty-note">Nothing to redeem just yet.</p>}</section><form className="admin-panel admin-create-form" onSubmit={createCoupon}><span className="eyebrow">A small kindness</span><h2>New coupon.</h2><label>Code<input required pattern="[A-Za-z0-9_-]{2,40}" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} /></label><label>Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="percent">Percent off</option><option value="fixed">Fixed INR amount</option></select></label><label>{form.type === "percent" ? "Discount · percent" : "Discount · INR"}<input required type="number" min="1" max={form.type === "percent" ? "100" : undefined} step="1" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} /></label><label>Minimum purchase · ₹<input type="number" min="0" step="1" value={form.minimumPurchase} onChange={(event) => setForm({ ...form, minimumPurchase: event.target.value })} /></label><label>Maximum uses<input required type="number" min="1" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} /></label><label>Ends at<input required type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label><button className="button button--dark" disabled={busy}><Plus size={15} /> Create a coupon</button></form></div>;
}

export function ReviewsAdmin() {
  const { data, loading, reload } = useAdminData("/admin/reviews");
  const { run } = useAdminAction();
  if (loading) return <AdminLoading />;
  return <div className="admin-panel"><SectionHead eyebrow="REAL CUSTOMER STORIES · YOUR CALL" title="Reviews, with a human eye." description="Only reviews linked to paid, delivered purchases are accepted. Approve them before the store displays them." />{data?.reviews.map((review) => <article key={review._id} className="admin-review"><div><div className="review-stars">{Array.from({ length: review.rating }, (_, index) => <Sparkles key={index} size={14} />)}</div><h3>{review.title || "A verified purchase"}</h3><p>{review.body}</p><span>{review.user?.name} · {review.product?.name} · {new Date(review.createdAt).toLocaleDateString("en-IN")}</span></div><div className="review-moderation"><span className={review.isApproved ? "payment-pill payment-pill--paid" : "payment-pill payment-pill--pending"}>{review.isApproved ? "Visible" : "Awaiting review"}</span><button className="button button--outline button--small" type="button" onClick={() => run(() => api.patch(`/admin/reviews/${review._id}`, { isApproved: !review.isApproved }), review.isApproved ? "Review hidden." : "Review approved.", reload)}>{review.isApproved ? "Hide" : "Approve"}</button></div></article>)}{!data?.reviews.length && <p className="empty-note">No customer reviews have arrived yet. No stories will be invented.</p>}</div>;
}

export function MessagesAdmin() {
  const { data, loading, reload } = useAdminData("/admin/contact");
  const { run } = useAdminAction();
  if (loading) return <AdminLoading />;
  return <div className="admin-panel"><SectionHead eyebrow="A PERSON WROTE THESE NOTES" title="Mail for the studio." description="Messages are stored privately and visible only to the shop administrator." />{data?.messages.map((message) => <article className="admin-message" key={message._id}><div><span className="eyebrow">{new Date(message.createdAt).toLocaleString("en-IN")} · {message.email}</span><h3>{message.subject}</h3><p className="admin-message__name">From {message.name}</p><p>{message.message}</p></div><select aria-label={`Change status of message from ${message.name}`} value={message.status} onChange={(event) => run(() => api.patch(`/admin/contact/${message._id}`, { status: event.target.value }), "Message status updated.", reload)}><option value="new">New</option><option value="read">Read</option><option value="resolved">Resolved</option></select></article>)}{!data?.messages.length && <p className="empty-note">The inbox is quiet. That's alright.</p>}</div>;
}

export function ReportsAdmin() {
  const [days, setDays] = useState(30);
  const { data, loading } = useAdminData(`/admin/overview?days=${days}`, [days]);
  if (loading) return <AdminLoading />;
  return <div className="admin-panel"><SectionHead eyebrow="THE NUMBERS THAT ARE ACTUALLY REAL" title="A gentle look back." description="Sales include completed payments only. Pending, failed, cancelled and refunded orders never inflate revenue." action={<label className="range-select">Date range <select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select></label>} />{data && <><div className="admin-stats"><StatCard title="Verified paid revenue · lifetime" value={money(data.metrics.revenue)} note="Excludes failed, pending and cancelled" icon={CircleDollarSign} /><StatCard title="Paid orders · lifetime" value={data.metrics.paidOrders.toLocaleString("en-IN")} note="Orders with verified payment confirmation" icon={Check} /></div><div className="admin-table-wrap report-table"><table className="admin-table"><thead><tr><th>Day</th><th>Confirmed orders</th><th>Paid revenue</th></tr></thead><tbody>{data.salesTrend.map((row) => <tr key={row._id}><td>{new Date(`${row._id}T12:00:00`).toLocaleDateString("en-IN", { dateStyle: "medium" })}</td><td>{row.orders}</td><td>{money(row.revenue)}</td></tr>)}{!data.salesTrend.length && <tr><td colSpan="3" className="table-empty">No verified sales in this period.</td></tr>}</tbody></table></div></>}</div>;
}

export function SettingsAdmin() {
  return <div className="admin-panel settings-admin"><SectionHead eyebrow="A FEW THINGS ONLY YOUR SERVER SHOULD KNOW" title="Care for the shop." description="Private credentials are configured on the server only. They are never entered or displayed in this page." /><div className="settings-grid"><article><ShieldCheck /><span>01 · PAYMENTS</span><h3>Razorpay test mode</h3><p>Set the server-only test key ID, key secret and webhook signing secret in <code>server/.env</code>. Start with keys marked <code>rzp_test_</code>. This browser never sees the secret key.</p><Link to="/shipping" className="text-link">Review shipping info <ArrowRight size={14} /></Link></article><article><Activity /><span>02 · PRODUCT PHOTOGRAPHS</span><h3>Cloudinary image uploads</h3><p>Add your Cloudinary cloud name, API key and API secret to <code>server/.env</code>. Until then, product managers can enter an existing image URL instead.</p></article><article><Inbox /><span>03 · CUSTOMER EMAIL</span><h3>Transactional emails</h3><p>Configure an SMTP host, account and application password on the server to enable one-time password-reset emails. Reset tokens are never sent without a valid email provider.</p></article><article><BarChart3 /><span>04 · PRIVATE ACCESS</span><h3>The secure way in</h3><p>Create an administrator account using the one-time <code>npm run create:admin</code> command. Account registration cannot grant administrator permissions.</p></article></div></div>;
}
