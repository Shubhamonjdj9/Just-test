import { motion, useReducedMotion } from "framer-motion";
import { Heart, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api, apiError, money } from "../api.js";
import { useShop } from "../context.jsx";

export default function ProductCard({ product, index = 0 }) {
  const { user, notify } = useShop();
  const reduceMotion = useReducedMotion();
  const image = product.images?.[0];
  const price = Math.round(product.price * (1 - (product.discountPercent ?? 0) / 100));

  async function toggleWishlist(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!user) return notify("Sign in to save the things you love.", "error");
    try {
      const { data } = await api.put(`/auth/me/wishlist/${product._id}`);
      notify(data.data.saved ? "Saved to your wishlist." : "Removed from your wishlist.");
    } catch (error) {
      notify(apiError(error), "error");
    }
  }

  return (
    <motion.article
      className="product-card"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : Math.min(index * 0.04, 0.2) }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
    >
      <div className="product-card__media">
        <Link to={`/product/${product.slug}`} aria-label={`View ${product.name}`}>
          {image
            ? <img src={image} alt={product.name} loading="lazy" width="680" height="820" />
            : <div className="product-placeholder" role="img" aria-label="Product photograph coming soon">A</div>}
        </Link>
        {product.discountPercent > 0 && <span className="product-tag">A little less</span>}
        <button type="button" className="product-favorite" onClick={toggleWishlist} aria-label={`Save ${product.name} to wishlist`}>
          <Heart size={17} strokeWidth={1.6} />
        </button>
        <Link className="product-quick-add" to={`/product/${product.slug}`}>
          Take a closer look <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="product-card__details">
        <div>
          <h3><Link to={`/product/${product.slug}`}>{product.name}</Link></h3>
          <span className="product-meta">
            {product.category?.name ?? product.brand ?? "Thoughtfully made"}
            {product.averageRating > 0 && ` · ${product.averageRating.toFixed(1)} (${product.reviewCount})`}
          </span>
        </div>
        <div className="product-prices">
          <span>{money(price)}</span>
          {price !== product.price && <del>{money(product.price)}</del>}
        </div>
      </div>
    </motion.article>
  );
}
