import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, Minus, Plus, Sparkles, Star, Truck, ShieldCheck, HandHeart } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, apiError, fetchProducts, money } from "../api.js";
import { useShop } from "../context.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { serializeVariantSelection } from "../variant.js";

const categoryImages = {
  living: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=85",
  objects: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1000&q=85",
  wear: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=85",
  "self-care": "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1000&q=85",
};

function LoadingTiles({ count = 4 }) {
  return (
    <div className="product-grid" aria-label="Loading products">
      {Array.from({ length: count }, (_, index) => <div className="skeleton-card" key={index}><div className="skeleton-image" /><div className="skeleton-line" /><div className="skeleton-line skeleton-line--short" /></div>)}
    </div>
  );
}

export function HomePage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { notify } = useShop();

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get("/categories"), fetchProducts({ featured: true, limit: 4 }), fetchProducts({ sort: "newest", limit: 4 })])
      .then(([categoryResponse, selected, newArrivals]) => {
        if (cancelled) return;
        setCategories(categoryResponse.data.data.categories);
        setProducts(selected.products);
        setLatest(newArrivals.products);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(apiError(requestError));
        notify(apiError(requestError), "error");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [notify]);

  return (
    <>
      <section className="hero">
        <img className="hero-image" src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2200&q=90" alt="Sunlit, quietly considered living room" fetchPriority="high" />
        <div className="hero-wash" />
        <div className="hero-inner">
          <span className="eyebrow hero-eyebrow"><span />A little more intentional</span>
          <h1>Make room<br />for the <em>everyday.</em></h1>
          <p>Thoughtfully made things for wherever home happens to be.</p>
          <Link to="/shop" className="button button--light">Explore the collection <ArrowRight size={16} /></Link>
        </div>
        <span className="hero-caption">Objects with a life beyond the moment · Est. 2021</span>
        <div className="hero-index"><span>01</span><span className="hero-index__line" />02</div>
      </section>

      <section className="intro-section section-wrap">
        <div className="intro-mark"><span>a.</span> A slower kind of store</div>
        <p>We believe in the pieces you pick up every morning, the things that find their place without asking. Useful. Considered. <em>Very much kept.</em></p>
        <Link className="text-link" to="/about">A little about us <ArrowRight size={15} /></Link>
      </section>

      <section className="category-section section-wrap">
        <div className="section-heading"><div><span className="eyebrow">Find your own pace</span><h2>What feels like <em>you?</em></h2></div><Link className="text-link desktop-only" to="/shop">Explore everything <ArrowRight size={15} /></Link></div>
        <div className="category-grid">
          {categories.slice(0, 4).map((category, index) => (
            <Link key={category.slug} to={`/category/${category.slug}`} className={`category-tile category-tile--${index + 1}`}>
              <img src={category.image || categoryImages[category.slug]} alt="" loading="lazy" width="900" height="1050" />
              <span className="category-tile__number">0{index + 1} / CATEGORY</span>
              <span className="category-tile__caption"><span><strong>{category.name}</strong><small>{category.description}</small></span><span className="category-arrow"><ArrowRight size={17} /></span></span>
            </Link>
          ))}
          {categories.length === 0 && !loading && <p className="empty-note">Our first collections are taking shape. Please check back shortly.</p>}
        </div>
      </section>

      <section className="curated-section section-wrap">
        <div className="section-heading">
          <div><span className="eyebrow"><Sparkles size={13} /> A few of our favourites</span><h2>Picked with <em>purpose.</em></h2></div>
          <Link className="text-link desktop-only" to="/shop?featured=true">See the whole edit <ArrowRight size={15} /></Link>
        </div>
        {loading ? <LoadingTiles /> : products.length ? <div className="product-grid">{products.map((product, index) => <ProductCard key={product._id} product={product} index={index} />)}</div> : <p className="empty-note">{error || "A few good things are on their way. Check back soon."}</p>}
        <div className="center-link mobile-only"><Link className="text-link" to="/shop">Explore everything <ArrowRight size={15} /></Link></div>
      </section>

      <section className="maker-band">
        <div className="maker-band__image"><img src="https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=1200&q=85" alt="Handmade stoneware on a maker's worktable" loading="lazy" width="1200" height="900" /></div>
        <div className="maker-band__copy">
          <span className="eyebrow">The people behind the pieces</span>
          <h2>Made well.<br /><em>Made by hand.</em></h2>
          <p>From family-run ceramic studios to independent textile houses, we work with people who take the long way and care about getting it right.</p>
          <Link to="/about" className="button button--outline">Meet the makers <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="new-arrivals-section section-wrap">
        <div className="section-heading"><div><span className="eyebrow">Just found their way here</span><h2>A fresh kind of <em>familiar.</em></h2></div><Link className="text-link desktop-only" to="/shop?sort=newest">All new arrivals <ArrowRight size={15} /></Link></div>
        {loading ? <LoadingTiles /> : latest.length ? <div className="product-grid">{latest.map((product, index) => <ProductCard key={product._id} product={product} index={index} />)}</div> : <p className="empty-note">New favourites are on their way.</p>}
      </section>

      <section className="values-strip section-wrap" aria-label="Why shop with Atelier">
        <Value icon={<HandHeart size={23} />} title="Thoughtfully sourced" description="Chosen for how it's made, and how long it'll last." />
        <Value icon={<Truck size={22} />} title="A softer footprint" description="Packed with care. Delivered from within India." />
        <Value icon={<ShieldCheck size={22} />} title="Secure, always" description="Protected checkout and dependable payments." />
        <Value icon={<Check size={21} />} title="Here if you need us" description="Real people, ready to lend a hand." />
      </section>

      <section className="closing-note">
        <span className="eyebrow">No rush. Good things take time.</span>
        <h2>Slow down.<br /><em>Choose well.</em></h2>
        <Link className="text-link" to="/shop">Find your next favourite <ArrowRight size={15} /></Link>
      </section>
    </>
  );
}

function Value({ icon, title, description }) {
  return <div className="value-item"><span className="value-icon">{icon}</span><div><h3>{title}</h3><p>{description}</p></div></div>;
}

export function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { slug } = useParams();
  const [catalog, setCatalog] = useState({ products: [], pagination: { page: 1, pages: 1, total: 0 } });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const params = useMemo(() => ({
    ...(searchParams.get("q") && { q: searchParams.get("q") }),
    ...(slug && { category: slug }),
    ...(searchParams.get("category") && { category: searchParams.get("category") }),
    ...(searchParams.get("brand") && { brand: searchParams.get("brand") }),
    ...(searchParams.get("minPrice") && { minPrice: searchParams.get("minPrice") }),
    ...(searchParams.get("maxPrice") && { maxPrice: searchParams.get("maxPrice") }),
    ...(searchParams.get("minRating") && { minRating: searchParams.get("minRating") }),
    ...(searchParams.get("featured") && { featured: searchParams.get("featured") }),
    ...(searchParams.get("inStock") && { inStock: searchParams.get("inStock") }),
    page: searchParams.get("page") ?? "1",
    limit: "12",
    sort: searchParams.get("sort") ?? "newest",
  }), [searchParams, slug]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      fetchProducts(params, controller.signal),
      api.get("/categories", { signal: controller.signal }),
    ])
      .then(([result, categoryResult]) => {
        setCatalog(result);
        setCategories(categoryResult.data.data.categories);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(apiError(requestError));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [params]);

  const currentCategory = categories.find((item) => item.slug === slug);
  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setSearchParams(next);
  };

  return (
    <section className="catalog-page section-wrap">
      <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span>{currentCategory ? <><Link to="/shop">Shop</Link><span>/</span></> : null}<span>{currentCategory?.name ?? "The whole collection"}</span></div>
      <div className="catalog-title"><div><span className="eyebrow">{searchParams.get("q") ? "A good thing is closer than you think" : "Objects to live with"}</span><h1>{searchParams.get("q") ? <>Found along the <em>way.</em></> : currentCategory?.name ?? <>The whole <em>collection.</em></>}</h1><p>{searchParams.get("q") ? <>Search results for “{searchParams.get("q")}”</> : currentCategory?.description ?? "A collection of thoughtful, useful things for wherever home happens to be."}</p></div><span className="catalog-result-count">{catalog.pagination.total} {catalog.pagination.total === 1 ? "piece" : "pieces"}</span></div>
      <div className="catalog-tools">
        <details className="filter-dropdown"><summary>Category <ChevronDown size={14} /></summary><div className="filter-options">{categories.map((category) => <button key={category.slug} type="button" onClick={() => setFilter("category", category.slug)}>{category.name}</button>)}</div></details>
        <details className="filter-dropdown"><summary>Price <ChevronDown size={14} /></summary><div className="price-filter"><label>Min ₹<input aria-label="Minimum price" type="number" min="0" value={searchParams.get("minPrice") ?? ""} onChange={(event) => setFilter("minPrice", event.target.value)} /></label><label>Max ₹<input aria-label="Maximum price" type="number" min="0" value={searchParams.get("maxPrice") ?? ""} onChange={(event) => setFilter("maxPrice", event.target.value)} /></label></div></details>
        <details className="filter-dropdown"><summary>Rating <ChevronDown size={14} /></summary><div className="filter-options">{["4", "3", "2", "1"].map((rating) => <button key={rating} type="button" onClick={() => setFilter("minRating", rating)}><Star size={13} fill="currentColor" /> {rating}+ stars</button>)}</div></details>
        <button type="button" className={`stock-filter ${searchParams.get("inStock") ? "stock-filter--active" : ""}`} onClick={() => setFilter("inStock", searchParams.has("inStock") ? "" : "true")}>Available now</button>
        <label className="sort-control">Sort by <select value={searchParams.get("sort") ?? "newest"} onChange={(event) => setFilter("sort", event.target.value)}><option value="newest">Just arrived</option><option value="popular">Most loved</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="rating">Customer rating</option></select></label>
        <button className="clear-filters" type="button" onClick={() => setSearchParams(slug ? new URLSearchParams() : { q: searchParams.get("q") ?? "" })}>Clear filters</button>
      </div>
      {error && <div className="inline-error" role="alert">{error}</div>}
      {loading ? <LoadingTiles count={8} /> : catalog.products.length ? (
        <>
          <div className="product-grid catalog-grid">{catalog.products.map((product, index) => <ProductCard key={product._id} product={product} index={index} />)}</div>
          {catalog.pagination.pages > 1 && <div className="pagination"><button type="button" disabled={catalog.pagination.page <= 1} onClick={() => setFilter("page", String(catalog.pagination.page - 1))}>Previous</button><span>Page {catalog.pagination.page} of {catalog.pagination.pages}</span><button type="button" disabled={catalog.pagination.page >= catalog.pagination.pages} onClick={() => setFilter("page", String(catalog.pagination.page + 1))}>Next</button></div>}
        </>
      ) : <div className="empty-state"><span className="empty-state__mark">a.</span><h2>Nothing here just yet.</h2><p>Try a different search or clear a filter. Good things have a way of turning up.</p><button className="button button--outline" type="button" onClick={() => setSearchParams({})}>See everything</button></div>}
    </section>
  );
}

export function ProductPage() {
  const { slug } = useParams();
  const { user, setItemCount, notify } = useShop();
  const [details, setDetails] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState({ rating: 5, title: "", body: "" });
  const [reviewBusy, setReviewBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSelectedVariants({});
    setSelectedImage(0);
    setQuantity(1);
    setLoading(true);
    api.get(`/products/${slug}`)
      .then(({ data }) => {
        if (!cancelled) setDetails(data.data);
      })
      .catch((error) => { if (!cancelled) notify(apiError(error), "error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, notify]);

  async function addToBag() {
    if (!details?.product) return;
    if (!user) return notify("Sign in to add this to your bag.", "error");
    const variant = serializeVariantSelection(details.product.variants ?? [], selectedVariants);
    if (details.product.variants?.length && !variant) return notify("Choose an option for each product variant.", "error");
    try {
      const { data } = await api.post("/cart/items", { productId: details.product._id, variant, quantity });
      setItemCount(data.data.itemCount);
      notify("A good choice. It's in your bag.");
    } catch (error) {
      notify(apiError(error), "error");
    }
  }

  async function saveWishlist() {
    if (!user) return notify("Sign in to save the things you love.", "error");
    try {
      const { data } = await api.put(`/auth/me/wishlist/${details.product._id}`);
      notify(data.data.saved ? "Saved for later." : "Removed from your wishlist.");
    } catch (error) {
      notify(apiError(error), "error");
    }
  }

  async function submitReview(event) {
    event.preventDefault();
    setReviewBusy(true);
    try {
      const { data } = await api.post(`/products/${slug}/reviews`, review);
      notify(data.data.message);
      setReview({ rating: 5, title: "", body: "" });
    } catch (error) {
      notify(apiError(error), "error");
    } finally {
      setReviewBusy(false);
    }
  }

  if (loading) return <div className="loading-page"><span className="spinner" />Finding that good thing…</div>;
  if (!details?.product) return <div className="empty-state empty-state--page"><h1>We couldn't find that piece.</h1><Link className="button button--outline" to="/shop">Back to the collection</Link></div>;

  const { product, reviews, related } = details;
  const salePrice = Math.round(product.price * (1 - (product.discountPercent ?? 0) / 100));

  return (
    <>
      <section className="product-detail section-wrap">
        <div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><Link to="/shop">Shop</Link><span>/</span><Link to={`/category/${product.category?.slug ?? "objects"}`}>{product.category?.name}</Link><span>/</span><span>{product.name}</span></div>
        <div className="product-detail__grid">
          <div className="gallery">
            <div className="gallery-main">{product.images?.[selectedImage] ? <img src={product.images[selectedImage]} alt={product.name} width="1100" height="1300" /> : <div className="product-placeholder">a.</div>}</div>
            {product.images?.length > 1 && <div className="gallery-thumbs">{product.images.map((image, index) => <button key={image} className={selectedImage === index ? "gallery-thumb gallery-thumb--active" : "gallery-thumb"} type="button" onClick={() => setSelectedImage(index)} aria-label={`View product image ${index + 1}`}><img src={image} alt="" loading="lazy" /></button>)}</div>}
          </div>
          <div className="product-detail__info">
            <div className="breadcrumbs product-category-label"><Link to={`/category/${product.category?.slug ?? "objects"}`}>{product.category?.name}</Link><span>·</span>{product.brand}</div>
            <h1>{product.name}</h1>
            <div className="product-detail-price"><strong>{money(salePrice)}</strong>{salePrice !== product.price && <><del>{money(product.price)}</del><span>You save {money(product.price - salePrice)}</span></>}</div>
            {product.reviewCount > 0 && <a className="review-summary" href="#customer-reviews"><Star size={15} fill="currentColor" /> {product.averageRating.toFixed(1)} · {product.reviewCount} verified {product.reviewCount === 1 ? "review" : "reviews"}</a>}
            <p className="product-detail__description">{product.description}</p>
            {product.variants?.map((variant) => <fieldset className="variant-selector" key={variant.name}><legend>{variant.name} {selectedVariants[variant.name] && <span>· {selectedVariants[variant.name]}</span>}</legend><div className="variant-options">{variant.options.map((option) => <button type="button" key={option} aria-pressed={selectedVariants[variant.name] === option} className={selectedVariants[variant.name] === option ? "variant-option variant-option--selected" : "variant-option"} onClick={() => setSelectedVariants((previous) => ({ ...previous, [variant.name]: option }))}>{option}</button>)}</div></fieldset>)}
            <div className="stock-note"><span className={product.stock > 0 ? "stock-indicator" : "stock-indicator stock-indicator--out"} />{product.stock > 0 ? (product.stock <= 5 ? `A few left · ${product.stock} available` : "A good choice. Ready to ship.") : "Currently out of stock"}</div>
            <div className="buy-row"><div className="quantity-control"><button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((count) => count - 1)}><Minus size={15} /></button><span>{quantity}</span><button type="button" aria-label="Increase quantity" disabled={quantity >= Math.min(99, product.stock)} onClick={() => setQuantity((count) => count + 1)}><Plus size={15} /></button></div><button type="button" className="button button--dark buy-button" disabled={!product.stock} onClick={addToBag}>Add to bag · {money(salePrice * quantity)}</button></div>
            <button type="button" className="text-link wishlist-link" onClick={saveWishlist}>Save for later <span>♡</span></button>
            <div className="purchase-details"><p><Truck size={17} /> Complimentary delivery on orders over ₹5,000</p><p><Check size={17} /> A thoughtful 14-day return window</p><p><ShieldCheck size={17} /> Secure payments via Razorpay</p></div>
            <details className="product-accordion"><summary>A few more details <ChevronDown size={16} /></summary><p>Chosen for the quality of its materials and for the people who made it. If you would like a hand choosing, <Link to="/contact">we're just a note away</Link>.</p></details>
          </div>
        </div>
      </section>
      <section className="review-section section-wrap" id="customer-reviews">
        <div className="section-heading"><div><span className="eyebrow">Notes from people who've lived with it</span><h2>Good things, <em>said well.</em></h2></div>{product.reviewCount > 0 && <div className="average-review"><Star size={18} fill="currentColor" />{product.averageRating.toFixed(1)}<span>· {product.reviewCount} reviews</span></div>}</div>
        {reviews.length ? <div className="reviews-grid">{reviews.map((item) => <article className="review-card" key={item._id}><div className="review-stars" aria-label={`${item.rating} out of 5 stars`}>{Array.from({ length: item.rating }, (_, index) => <Star key={index} size={14} fill="currentColor" />)}</div><h3>{item.title || "A lovely little thing"}</h3><p>{item.body}</p><span>{item.user?.name || "Customer"} · Verified purchase</span></article>)}</div> : <p className="empty-note">No reviews yet. We’ll share the first one when a verified customer has received this piece.</p>}
        {user && <form className="review-form form-card" onSubmit={submitReview}><h3>Write a verified review</h3><p>Reviews can be submitted by customers who have received this piece; they appear after moderation.</p><label>Your rating<select value={review.rating} onChange={(event) => setReview({ ...review, rating: Number(event.target.value) })}>{[5, 4, 3, 2, 1].map((rating) => <option value={rating} key={rating}>{rating} star{rating === 1 ? "" : "s"}</option>)}</select></label><label>Title <input maxLength="120" value={review.title} onChange={(event) => setReview({ ...review, title: event.target.value })} /></label><label>Your notes <textarea minLength="10" maxLength="2000" required value={review.body} onChange={(event) => setReview({ ...review, body: event.target.value })} /></label><button className="button button--dark" type="submit" disabled={reviewBusy}>{reviewBusy ? "Sending…" : "Submit your review"}</button></form>}
      </section>
      {related.length > 0 && <section className="related-section section-wrap"><div className="section-heading"><div><span className="eyebrow">Since you're already here</span><h2>Goes well <em>with.</em></h2></div></div><div className="product-grid">{related.map((item, index) => <ProductCard key={item._id} product={item} index={index} />)}</div></section>}
    </>
  );
}

export function ContactPage() {
  const { notify } = useShop();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/contact", form);
      notify(data.data.message);
      setForm({ name: "", email: "", subject: "", message: "", website: "" });
    } catch (error) {
      notify(apiError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  return <section className="editorial-page"><div className="section-wrap contact-grid"><div><span className="eyebrow">A real person, on the other end</span><h1>Come <em>say hello.</em></h1><p>Have a question about a piece, an order or something else on your mind? We read every note ourselves.</p><div className="contact-aside"><span>STUDIO HOURS</span><p>Monday–Friday · 10am–5pm IST</p><span>REPLIES</span><p>Usually within two working days.</p></div></div><form className="contact-form form-card" onSubmit={submit}><label>Your name<input autoComplete="name" required maxLength="100" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Email address<input type="email" autoComplete="email" required maxLength="254" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>What can we help with?<input required maxLength="160" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label><label>A note from you<textarea required minLength="10" maxLength="4000" rows="5" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label><div className="website-trap" aria-hidden="true"><label htmlFor="contact-website">Leave this empty<input id="contact-website" tabIndex="-1" autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label></div><button className="button button--dark" type="submit" disabled={busy}>{busy ? "Sending your note…" : "Send us a note"} <ArrowRight size={15} /></button><p className="form-note">Your details are used to respond to your message.</p></form></div></section>;
}

const pageContent = {
  about: { eyebrow: "A note about this little shop", title: <>Well-made things.<br /><em>A life well lived.</em></>, paragraphs: ["Atelier is a small Indian design-led store for useful, quietly beautiful things. A place to find the cup you reach for each morning, the cloth that softens with time, and the objects that settle into home as if they were always there.", "We choose slowly, sourcing from independent makers and small-run studios who respect their materials and the people working with them. We don't believe you need more. We believe choosing a little better makes a difference.", "Everything you find here is a real piece, offered at an honest price and shipped from within India. If we can help you choose, or if something isn't right, there's a real person on the other side of our contact page."] },
  faq: { eyebrow: "The little things worth knowing", title: <>Some common<br /><em>questions.</em></>, paragraphs: ["When will my order arrive? Most orders are prepared in 1–2 working days and delivered within 3–7 working days. Delivery estimates depend on your address; your order page displays the information we have.", "Can I return a piece? Unused, non-personalised items can be returned within 14 days after delivery. Please get in touch with your order number and we’ll help arrange the next steps.", "How can I pay? Checkout supports the payment options enabled for our store through Razorpay. Your payment is confirmed by our server before an order is marked as paid.", "Need a hand with something else? Our contact page goes to the team, not a bot."] },
  shipping: { eyebrow: "From our hands to yours", title: <>Wrapped with care.<br /><em>Delivered in good time.</em></>, paragraphs: ["Orders are prepared within 1–2 working days. Delivery times are estimated at checkout and vary according to your destination; you’ll be able to follow your order in your account.", "We offer complimentary standard delivery on eligible orders over ₹5,000. The final shipping charge is calculated by the server and displayed before payment.", "We’re happy to help with returns on unused, non-personalised items requested within 14 days of delivery. Start on your order details page or send us a note through Contact. Refund timing depends on your bank and payment method."] },
  privacy: { eyebrow: "A little about your information", title: <>Your trust<br /><em>matters to us.</em></>, paragraphs: ["We use the information you share to fulfil orders, manage your account, protect our store, and respond to your enquiries. Account passwords are hashed and never stored in plain text.", "Payment details are processed by Razorpay. Our store does not collect or store card numbers. We share the minimum order information necessary with our payment and delivery providers.", "You can contact us to ask about access to or deletion of your personal information. We keep order records where required to operate our store and meet our legal obligations."] },
  terms: { eyebrow: "A few mutual agreements", title: <>Clear, simple<br /><em>terms of service.</em></>, paragraphs: ["Product availability, stock, delivery, and pricing are confirmed against the information on this site at the time of checkout. An order becomes paid only after its payment has been verified by our server or verified payment notification.", "You are responsible for the accuracy of your delivery details and account credentials. Please let us know promptly if something seems wrong with your account or order.", "For questions, returns or support, please write to us via our Contact page. Nothing in these terms limits rights granted to you under applicable Indian consumer-protection law."] },
};

export function EditorialPage({ page }) {
  const content = pageContent[page];
  if (!content) return null;
  return <section className="editorial-page"><article className="editorial-content"><span className="eyebrow">{content.eyebrow}</span><h1>{content.title}</h1>{content.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<Link to="/contact" className="button button--outline">Here if you need us <ArrowRight size={15} /></Link></article></section>;
}

export function NotFoundPage() {
  return <section className="empty-state empty-state--page"><span className="empty-state__mark">a.</span><span className="eyebrow">A little off the beaten path</span><h1>This page isn't here.</h1><p>We looked; no luck. But the good stuff is only a few steps away.</p><Link to="/shop" className="button button--dark">Back to the shop <ArrowRight size={15} /></Link></section>;
}
