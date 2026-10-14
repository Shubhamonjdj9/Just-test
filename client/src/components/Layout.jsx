import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowRight, Heart, Instagram, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { Link, NavLink, useLocation, useNavigate, useOutlet, useSearchParams } from "react-router-dom";
import { api, apiError } from "../api.js";
import { useShop } from "../context.jsx";

export default function StoreLayout() {
  const { user, itemCount, notify } = useShop();
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (query.trim().length < 2 || !searchOpen) {
      setSuggestions([]);
      return undefined;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const { data } = await api.get("/products/suggestions", {
          params: { q: query },
          signal: controller.signal,
        });
        setSuggestions(data.data.products);
      } catch (error) {
        if (!controller.signal.aborted) notify(apiError(error), "error");
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, searchOpen, notify]);

  function submitSearch(event) {
    event.preventDefault();
    setSearchOpen(false);
    setSuggestions([]);
    const value = query.trim();
    navigate(value ? `/shop?q=${encodeURIComponent(value)}` : "/shop");
  }

  return (
    <>
      <div className="announcement">
        <p>Small things, thoughtfully chosen. <Link to="/shop">Meet the spring edit <ArrowRight size={13} /></Link></p>
      </div>
      <header className="site-header">
        <div className="header-shell">
          <button type="button" className="icon-button mobile-only" aria-label={menuOpen ? "Close navigation" : "Open navigation"} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link to="/" className="wordmark" aria-label="Atelier home">atelier<span>.</span></Link>
          <nav className={`primary-nav ${menuOpen ? "primary-nav--open" : ""}`} aria-label="Main navigation">
            <NavLink to="/shop" onClick={() => setMenuOpen(false)}>Shop</NavLink>
            <NavLink to="/category/living" onClick={() => setMenuOpen(false)}>Living</NavLink>
            <NavLink to="/category/objects" onClick={() => setMenuOpen(false)}>Objects</NavLink>
            <NavLink to="/category/wear" onClick={() => setMenuOpen(false)}>Wear</NavLink>
            <NavLink to="/about" onClick={() => setMenuOpen(false)}>Our story</NavLink>
          </nav>
          <div className="header-actions">
            <button type="button" className="icon-button" aria-label={searchOpen ? "Close search" : "Search"} onClick={() => setSearchOpen(!searchOpen)}>
              {searchOpen ? <X size={19} /> : <Search size={19} />}
            </button>
            <Link to={user ? (user.role === "admin" ? "/admin" : "/account") : "/login"} className="icon-button header-account" aria-label={user ? "Your account" : "Sign in"}>
              <UserRound size={19} />
            </Link>
            <Link to="/wishlist" className="icon-button wishlist-nav" aria-label="Your wishlist">
              <Heart size={18} />
            </Link>
            <Link to="/cart" className="icon-button bag-link" aria-label={`Shopping bag, ${itemCount} items`}>
              <ShoppingBag size={19} /> <span>Bag{itemCount > 0 ? ` (${itemCount})` : ""}</span>
            </Link>
          </div>
        </div>
        {searchOpen && (
          <div className="search-panel">
            <form className="search-form" onSubmit={submitSearch}>
              <Search size={19} aria-hidden="true" />
              <label htmlFor="store-search" className="sr-only">Search the store</label>
              <input autoFocus id="store-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find something thoughtful…" />
              <button type="submit" className="button button--dark button--small">Search</button>
            </form>
            {suggestions.length > 0 && (
              <ul className="search-suggestions">
                {suggestions.map((product) => (
                  <li key={product._id}><Link to={`/product/${product.slug}`} onClick={() => setSearchOpen(false)}>{product.name}<ArrowRight size={14} /></Link></li>
                ))}
              </ul>
            )}
          </div>
        )}
      </header>
      <main>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
            transition={{ duration: reduceMotion ? 0 : 0.19 }}
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </>
  );
}

function Footer() {
  const { notify } = useShop();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function subscribe(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/newsletter", { email });
      notify(data.data.message);
      setEmail("");
    } catch (error) {
      notify(apiError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <Link to="/" className="wordmark wordmark--footer">atelier<span>.</span></Link>
          <p className="footer-intro">Thoughtful design. Fewer, better things.<br />Made to be kept, and to feel like home.</p>
          <a className="social-link" href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Atelier on Instagram"><Instagram size={18} /> A little more on Instagram <ArrowDownRight size={15} /></a>
        </div>
        <div className="footer-links">
          <div><h3>Come on in</h3><Link to="/shop">Everything</Link><Link to="/category/living">The Living Edit</Link><Link to="/category/objects">Objects & Form</Link><Link to="/category/wear">Wear Well</Link></div>
          <div><h3>Here to help</h3><Link to="/contact">Contact</Link><Link to="/shipping">Shipping & returns</Link><Link to="/faq">Common questions</Link><Link to="/account">Your account</Link></div>
          <div className="newsletter">
            <h3>Notes from the studio</h3><p>New pieces, makers' stories and the occasional good thing. No noise.</p>
            <form onSubmit={subscribe} className="newsletter-form">
              <label className="sr-only" htmlFor="newsletter-email">Your email address</label>
              <input id="newsletter-email" type="email" autoComplete="email" required placeholder="Your email address" value={email} onChange={(event) => setEmail(event.target.value)} />
              <button disabled={busy} type="submit" aria-label="Subscribe to the newsletter"><ArrowRight size={18} /></button>
            </form>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Atelier. Made with intention.</span>
        <div><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><span>India · INR ₹</span></div>
      </div>
    </footer>
  );
}
